/**
 * 低层查询语句/过滤器构建器。
 * Model.query() 的链式 API 类型在 ORM 中，请使用 SQLModelQueryBuilder / MongoModelQueryBuilder。
 */

export { SQLQueryBuilder, SQLStatementBuilder } from "./sql-builder.ts";
export { MongoQueryBuilder, MongoStatementBuilder } from "./mongo-builder.ts";

export type { MongoWhereCondition } from "../orm/mongo-model.ts";
export type { WhereCondition } from "../orm/sql-model.ts";
