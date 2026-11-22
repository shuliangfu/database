/**
 * @fileoverview 四库测试夹具：连接、DDL、清表、主键与模型构造
 */

import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoModel } from "../../src/orm/mongo-model.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter, DatabaseConfig } from "../../src/types.ts";
import { expect } from "@dreamer/test";
import {
  createMongoConfig,
  createMysqlConfig,
  createPostgresConfig,
  createSqliteConfig,
} from "./configs.ts";

export type EngineKind = "sqlite" | "mysql" | "postgresql" | "mongodb";

/** 测试模型构造器（SQLModel / MongoModel 的结构类型） */
export type AnyModelClass =
  & (abstract new (...args: any[]) => any)
  & Record<string, any>;

export type ColumnType =
  | "pk"
  | "int"
  | "varchar"
  | "text"
  | "real"
  | "datetime";

export interface ColumnDef {
  name: string;
  type: ColumnType;
  notNull?: boolean;
  unique?: boolean;
  defaultSql?: string;
  /** MySQL 的 ON UPDATE CURRENT_TIMESTAMP（仅 updated_at） */
  mysqlOnUpdate?: boolean;
}

export interface EngineFixture {
  kind: EngineKind;
  label: string;
  modelLabel: string;
  Model: AnyModelClass;
  storeProp: "tableName" | "collectionName";
  primaryKey: string;
  isDocument: boolean;

  storeName(suite: string, key: string): string;
  createConfig(overrides?: Record<string, unknown>): DatabaseConfig;
  connect(
    overrides?: Record<string, unknown>,
  ): Promise<DatabaseAdapter | undefined>;
  close(): Promise<void>;

  quoteIdent(name: string): string;
  dropStore(adapter: DatabaseAdapter, name: string): Promise<void>;
  createTable(
    adapter: DatabaseAdapter,
    name: string,
    columns: ColumnDef[],
  ): Promise<void>;
  clearStore(adapter: DatabaseAdapter, name: string): Promise<void>;
  clearCategoryRefs(
    adapter: DatabaseAdapter,
    usersStore: string,
  ): Promise<void>;
  ensureIntColumn(
    adapter: DatabaseAdapter,
    table: string,
    column: string,
  ): Promise<void>;

  /** 关联字段在 schema 中的 type（SQL number，Mongo 视用例而定） */
  refFieldType: "number" | "string" | "any";
  compareRefFieldType: "number" | "any";
  missingRefId: number | string;

  /** 记录主键值（Mongo 为 ObjectId，写入关联字段请用这个） */
  id(record: any): any;
  /** 可比较的标量主键（Mongo 为字符串，用于 toBe / === / >） */
  cmpId(record: any): any;
  /** 传给 update / findById 的主键参数（Mongo 需 String(_id)） */
  idArg(record: any): any;
  /** 写入关联字段的值（Mongo exists 用例用 String(_id)） */
  refValue(record: any): any;
  expectRefEqual(actual: any, record: any): void;

  storeRef(name: string): { table: string } | { collection: string };
  skipMessage(): string;
  itOptions(): { sanitizeOps: false; sanitizeResources: false } | undefined;
}

const STORE_NAMES: Record<EngineKind, Record<string, string>> = {
  sqlite: {
    "validation.users": "test_sqlite_validation_users",
    "validation.categories": "test_sqlite_validation_categories",
    "validation.banned": "test_sqlite_validation_banned_emails",
    "validation.unique": "test_sqlite_validation_unique_test",
    "model.users": "test_sqlite_users",
    "model.softDelete": "test_sqlite_soft_delete_users",
    "model.categories": "test_sqlite_categories",
    "model.posts": "test_sqlite_posts",
    "model.profiles": "test_sqlite_profiles",
    "queryBuilder.users": "test_sqlite_query_builder_users",
    "queryBuilder.posts": "test_sqlite_query_builder_posts",
    "cache.users": "test_sqlite_cache_test_users",
    "fullWorkflow.users": "test_sqlite_full_workflow_integration_users",
    "transaction.accounts": "accounts",
  },
  mysql: {
    "validation.users": "mysql_validation_users",
    "validation.categories": "mysql_validation_categories",
    "validation.banned": "mysql_validation_banned_emails",
    "validation.unique": "mysql_validation_unique_test",
    "model.users": "mysql_model_users",
    "model.softDelete": "mysql_model_soft_delete_users",
    "model.categories": "mysql_model_categories",
    "model.posts": "mysql_model_posts",
    "model.profiles": "mysql_model_profiles",
    "queryBuilder.users": "mysql_query_builder_users",
    "queryBuilder.posts": "mysql_query_builder_posts",
    "cache.users": "mysql_cache_test_users",
    "fullWorkflow.users": "mysql_full_workflow_integration_users",
    "transaction.accounts": "mysql_transaction_accounts",
  },
  postgresql: {
    "validation.users": "postgresql_validation_users",
    "validation.categories": "postgresql_validation_categories",
    "validation.banned": "postgresql_validation_banned_emails",
    "validation.unique": "postgresql_validation_unique_test",
    "model.users": "postgresql_model_users",
    "model.softDelete": "postgresql_model_soft_delete_users",
    "model.categories": "postgresql_model_categories",
    "model.posts": "postgresql_model_posts",
    "model.profiles": "postgresql_model_profiles",
    "queryBuilder.users": "postgresql_query_builder_users",
    "queryBuilder.posts": "postgresql_query_builder_posts",
    "cache.users": "postgresql_cache_test_users",
    "fullWorkflow.users": "postgresql_full_workflow_integration_users",
    "transaction.accounts": "accounts",
  },
  mongodb: {
    "validation.users": "mongo_validation_users",
    "validation.categories": "mongo_validation_categories",
    "validation.banned": "mongo_validation_banned_emails",
    "validation.unique": "mongo_validation_unique_test",
    "model.users": "mongo_model_users",
    "model.softDelete": "mongo_model_soft_delete_users",
    "model.categories": "mongo_model_categories",
    // 原 mongo/model.test.ts 从 MySQL 拷贝时误用了 mysql_ 前缀，此处保持原名以免改变已有集合
    "model.posts": "mysql_model_posts",
    "model.profiles": "mysql_model_profiles",
    "queryBuilder.users": "mongo_query_builder_users",
    "cache.users": "mongo_cache_cache_test_mongo_users",
    "fullWorkflow.users": "mongo_full_workflow_integration_users",
    "transaction.accounts": "mongo_transaction_accounts",
  },
};

function columnSql(
  kind: EngineKind,
  col: ColumnDef,
  quote: (name: string) => string,
): string {
  const n = quote(col.name);
  let sql: string;
  switch (col.type) {
    case "pk":
      if (kind === "sqlite") sql = `${n} INTEGER PRIMARY KEY AUTOINCREMENT`;
      else if (kind === "mysql") sql = `${n} INT AUTO_INCREMENT PRIMARY KEY`;
      else sql = `${n} SERIAL PRIMARY KEY`;
      break;
    case "int":
      sql = kind === "mysql" ? `${n} INT` : `${n} INTEGER`;
      break;
    case "varchar":
      sql = `${n} VARCHAR(255)`;
      break;
    case "text":
      sql = `${n} TEXT`;
      break;
    case "real":
      sql = kind === "sqlite" ? `${n} REAL` : `${n} DECIMAL(10,2)`;
      break;
    case "datetime":
      sql = kind === "postgresql" ? `${n} TIMESTAMP` : `${n} DATETIME`;
      break;
  }
  if (col.notNull) sql += " NOT NULL";
  if (col.unique) sql += " UNIQUE";
  if (col.defaultSql) sql += ` DEFAULT ${col.defaultSql}`;
  if (col.mysqlOnUpdate && kind === "mysql") {
    sql += " ON UPDATE CURRENT_TIMESTAMP";
  }
  return sql;
}

function createFixture(kind: EngineKind): EngineFixture {
  const isDocument = kind === "mongodb";
  const label = {
    sqlite: "SQLite",
    mysql: "MySQL",
    postgresql: "PostgreSQL",
    mongodb: "MongoDB",
  }[kind];
  const modelLabel = isDocument ? "MongoModel" : "SQLModel";
  const Model =
    (isDocument ? MongoModel : SQLModel) as unknown as AnyModelClass;
  const storeProp = isDocument
    ? "collectionName" as const
    : "tableName" as const;
  const primaryKey = isDocument ? "_id" : "id";

  const quoteIdent = (name: string): string => {
    if (kind === "postgresql" && /[A-Z]/.test(name)) return `"${name}"`;
    return name;
  };

  const fx: EngineFixture = {
    kind,
    label,
    modelLabel,
    Model,
    storeProp,
    primaryKey,
    isDocument,
    refFieldType: isDocument ? "string" : "number",
    compareRefFieldType: isDocument ? "any" : "number",
    missingRefId: isDocument ? "507f1f77bcf86cd799439011" : 99999,

    storeName(suite: string, key: string): string {
      const id = `${suite}.${key}`;
      const name = STORE_NAMES[kind][id];
      if (!name) {
        throw new Error(`Unknown store name: ${id} for ${kind}`);
      }
      return name;
    },

    createConfig(overrides?: Record<string, unknown>): DatabaseConfig {
      if (kind === "sqlite") {
        return createSqliteConfig(overrides as { filename?: string });
      }
      if (kind === "mysql") {
        return createMysqlConfig(overrides as any);
      }
      if (kind === "postgresql") {
        return createPostgresConfig(overrides as any);
      }
      return createMongoConfig(overrides as any);
    },

    async connect(
      overrides?: Record<string, unknown>,
    ): Promise<DatabaseAdapter | undefined> {
      try {
        try {
          await closeDatabase();
        } catch {
          // 忽略清理错误
        }
        await initDatabase(fx.createConfig(overrides));
        return getDatabase();
      } catch (error) {
        console.log(`${label} not available, skipping tests`);
        console.error(error);
        return undefined;
      }
    },

    async close(): Promise<void> {
      try {
        await closeDatabase();
      } catch {
        // 忽略关闭错误
      }
    },

    quoteIdent,

    async dropStore(adapter: DatabaseAdapter, name: string): Promise<void> {
      if (isDocument) {
        const db = (adapter as any)?.getDatabase?.();
        if (db) await db.collection(name).drop().catch(() => {});
        return;
      }
      const cascade = kind === "postgresql" ? " CASCADE" : "";
      await adapter.execute(`DROP TABLE IF EXISTS ${name}${cascade}`, [])
        .catch(() => {});
    },

    async createTable(
      adapter: DatabaseAdapter,
      name: string,
      columns: ColumnDef[],
    ): Promise<void> {
      if (isDocument) return;
      await fx.dropStore(adapter, name);
      const body = columns.map((col) => columnSql(kind, col, quoteIdent)).join(
        ",\n          ",
      );
      await adapter.execute(
        `CREATE TABLE ${name} (\n          ${body}\n        )`,
        [],
      );
    },

    async clearStore(adapter: DatabaseAdapter, name: string): Promise<void> {
      if (!adapter) return;
      if (isDocument) {
        const db = (adapter as any)?.getDatabase?.();
        if (db) await db.collection(name).deleteMany({});
        return;
      }
      await adapter.execute(`DELETE FROM ${name}`, []);
    },

    async clearCategoryRefs(
      adapter: DatabaseAdapter,
      usersStore: string,
    ): Promise<void> {
      if (!adapter) return;
      if (isDocument) {
        const db = (adapter as any)?.getDatabase?.();
        if (db) {
          await db.collection(usersStore).deleteMany({
            categoryId: { $exists: true },
          });
        }
        return;
      }
      await adapter.execute(
        `DELETE FROM ${usersStore} WHERE ${
          quoteIdent("categoryId")
        } IS NOT NULL`,
        [],
      );
    },

    async ensureIntColumn(
      adapter: DatabaseAdapter,
      table: string,
      column: string,
    ): Promise<void> {
      if (isDocument || !adapter) return;
      const typ = kind === "mysql" ? "INT" : "INTEGER";
      await adapter.execute(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${
          quoteIdent(column)
        } ${typ} DEFAULT 0`,
        [],
      ).catch(() => {});
    },

    id(record: any): any {
      return record?.[primaryKey];
    },

    cmpId(record: any): any {
      const value = record?.[primaryKey];
      if (isDocument) return value == null ? value : String(value);
      return value;
    },

    idArg(record: any): any {
      const value = record?.[primaryKey];
      return isDocument ? String(value) : value;
    },

    refValue(record: any): any {
      const value = record?.[primaryKey];
      return isDocument ? String(value) : value;
    },

    expectRefEqual(actual: any, record: any): void {
      const expected = record?.[primaryKey];
      if (isDocument) {
        expect(String(actual)).toBe(String(expected));
        return;
      }
      expect(actual).toBe(expected);
    },

    storeRef(name: string) {
      return isDocument ? { collection: name } : { table: name };
    },

    skipMessage(): string {
      return `${label} not available, skipping test`;
    },

    itOptions() {
      return isDocument
        ? { sanitizeOps: false as const, sanitizeResources: false as const }
        : undefined;
    },
  };

  return fx;
}

export const sqliteFixture = createFixture("sqlite");
export const mysqlFixture = createFixture("mysql");
export const postgresFixture = createFixture("postgresql");
export const mongoFixture = createFixture("mongodb");

export function skipIfUnavailable(
  adapter: DatabaseAdapter | undefined,
  fx: EngineFixture,
): adapter is DatabaseAdapter {
  if (adapter) return true;
  console.log(fx.skipMessage());
  return false;
}
