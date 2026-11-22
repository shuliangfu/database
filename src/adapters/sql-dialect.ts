/**
 * SQL 方言能力：标识符引用、RETURNING、upsert、TRUNCATE。
 * 由 SQLite / MySQL / PostgreSQL 适配器实现，模型侧不再按 adapter 名分支。
 */

import type { DatabaseAdapter } from "../types.ts";

export type SqlDialectName = "sqlite" | "mysql" | "postgresql";

export type ReturningOperation =
  | "insert"
  | "insertMany"
  | "update"
  | "increment";

export interface SqlAdapter extends DatabaseAdapter {
  readonly sqlDialect: SqlDialectName;
  quoteIdentifier(fieldName: string): string;
  formatDateForDatabase(date: Date): string;
  appendReturning(sql: string, returning: string): string;
  shouldUseReturning(
    operation: ReturningOperation,
    options?: { returnLatest?: boolean },
  ): boolean;
  shouldRetryWithoutReturning(operation: ReturningOperation): boolean;
  supportsDialectUpsert(conflictKeys: string[]): boolean;
  buildUpsertSql(
    tableName: string,
    columns: string[],
    conflictKeys: string[],
  ): string;
  buildTruncateStatements(
    tableName: string,
  ): Array<{ sql: string; params?: any[]; ignoreError?: boolean }>;
}

export function isSqlAdapter(
  adapter: DatabaseAdapter | null | undefined,
): adapter is SqlAdapter {
  return !!adapter &&
    typeof (adapter as SqlAdapter).quoteIdentifier === "function" &&
    typeof (adapter as SqlAdapter).sqlDialect === "string";
}

/** 三个 SQL 方言共用的日期格式（YYYY-MM-DD HH:MM:SS，不含毫秒）。 */
export function formatSqlDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function appendReturningClause(sql: string, returning: string): string {
  return `${sql} RETURNING ${returning}`;
}

const IDENT_PART = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_IDENT_PARTS = 3;
const MAX_IDENT_LENGTH = 128;
const FORBIDDEN_IDENT_PARTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export class InvalidSqlIdentifierError extends Error {
  constructor(name: string) {
    const shown = name.length > 64 ? `${name.slice(0, 64)}…` : name;
    super(`Invalid SQL identifier: ${shown}`);
    this.name = "InvalidSqlIdentifierError";
  }
}

/**
 * 校验拼进 SQL 的标识符（表名、列名、schema.table.column）。
 * 允许 `*` 以及用点号分段的合法标识符，拒绝空格、换行、分号、引号等注入字符。
 */
export function assertSafeSqlIdentifier(name: string): string {
  if (typeof name !== "string" || name.length === 0) {
    throw new InvalidSqlIdentifierError(String(name ?? ""));
  }
  if (name === "*") {
    return name;
  }
  const parts = name.split(".");
  if (parts.length === 0 || parts.length > MAX_IDENT_PARTS) {
    throw new InvalidSqlIdentifierError(name);
  }
  for (const part of parts) {
    if (part === "*") continue;
    if (
      !IDENT_PART.test(part) ||
      part.length > MAX_IDENT_LENGTH ||
      FORBIDDEN_IDENT_PARTS.has(part)
    ) {
      throw new InvalidSqlIdentifierError(name);
    }
  }
  return name;
}

function quoteParts(
  fieldName: string,
  quotePart: (part: string) => string,
): string {
  const name = assertSafeSqlIdentifier(fieldName);
  if (name === "*") return "*";
  return name.split(".").map((part) => part === "*" ? "*" : quotePart(part))
    .join(".");
}

export function quotePostgresIdentifier(fieldName: string): string {
  return quoteParts(fieldName, (part) => {
    // 含大写时 PostgreSQL 会折叠，必须加双引号
    if (/[A-Z]/.test(part)) {
      return `"${part}"`;
    }
    return part;
  });
}

export function quoteMySqlIdentifier(fieldName: string): string {
  return quoteParts(fieldName, (part) => `\`${part}\``);
}

export function quoteSqliteIdentifier(fieldName: string): string {
  // 合法标识符无需加引号，保持现有 SQL 形态；非法名称在校验时拒绝
  return quoteParts(fieldName, (part) => part);
}

export function buildPostgresUpsertSql(
  tableName: string,
  columns: string[],
  conflictKeys: string[],
): string {
  const table = quotePostgresIdentifier(tableName);
  const cols = columns.map((k) => quotePostgresIdentifier(k));
  const keys = conflictKeys.map((k) => quotePostgresIdentifier(k));
  const placeholders = cols.map(() => "?").join(", ");
  const updateSet = cols.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
  return `INSERT INTO ${table} (${
    cols.join(", ")
  }) VALUES (${placeholders}) ON CONFLICT (${
    keys.join(", ")
  }) DO UPDATE SET ${updateSet} RETURNING *`;
}

export function buildMySqlUpsertSql(
  tableName: string,
  columns: string[],
): string {
  const table = quoteMySqlIdentifier(tableName);
  const cols = columns.map((k) => quoteMySqlIdentifier(k));
  const placeholders = cols.map(() => "?").join(", ");
  const updateSet = cols.map((k) => `${k} = VALUES(${k})`).join(", ");
  return `INSERT INTO ${table} (${
    cols.join(", ")
  }) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSet}`;
}
