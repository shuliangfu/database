/**
 * SQL GROUP BY / HAVING / 聚合表达式的校验与拼装。
 * 聚合只允许 COUNT / SUM / AVG / MIN / MAX，参数为 * 或合法标识符。
 * HAVING 是带占位符的参数化 SQL 片段（逃生舱，调用方负责绑定参数）。
 */

import { assertSafeSqlIdentifier } from "../../adapters/sql-dialect.ts";

export type SqlHaving = { sql: string; params: unknown[] };
export type SqlAggregates = Record<string, string>;

const AGG_EXPR =
  /^(COUNT|SUM|AVG|MIN|MAX)\(\s*(DISTINCT\s+)?(\*|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){0,2})\s*\)$/i;

export class InvalidSqlAggregateError extends Error {
  constructor(expr: string) {
    super(`Invalid SQL aggregate expression: ${expr}`);
    this.name = "InvalidSqlAggregateError";
  }
}

export function normalizeGroupBy(columns: string | string[]): string[] {
  const list = (Array.isArray(columns) ? columns : [columns]).map((c) =>
    c.trim()
  );
  if (list.length === 0 || list.some((c) => !c)) {
    throw new InvalidSqlAggregateError("(empty GROUP BY)");
  }
  return list.map((c) => assertSafeSqlIdentifier(c));
}

export function formatAggregateSelect(
  aggregates: SqlAggregates,
  escape: (name: string) => string,
): string {
  const parts: string[] = [];
  for (const [alias, expr] of Object.entries(aggregates)) {
    assertSafeSqlIdentifier(alias);
    const trimmed = String(expr).trim();
    const match = trimmed.match(AGG_EXPR);
    if (!match) {
      throw new InvalidSqlAggregateError(trimmed);
    }
    const fn = match[1].toUpperCase();
    const distinct = match[2] ? "DISTINCT " : "";
    const field = match[3];
    const arg = field === "*" ? "*" : escape(field);
    parts.push(`${fn}(${distinct}${arg}) AS ${escape(alias)}`);
  }
  return parts.join(", ");
}

export function appendGroupByHaving(
  sql: string,
  params: unknown[],
  groupBy: string[] | undefined,
  having: SqlHaving | undefined,
  escape: (name: string) => string,
): { sql: string; params: unknown[] } {
  let out = sql;
  const next = [...params];
  if (groupBy && groupBy.length > 0) {
    out += ` GROUP BY ${groupBy.map((col) => escape(col)).join(", ")}`;
  }
  if (having && having.sql.trim()) {
    out += ` HAVING ${having.sql}`;
    if (having.params && having.params.length > 0) {
      next.push(...having.params);
    }
  }
  return { sql: out, params: next };
}
