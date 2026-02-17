/**
 * ORM/ODM 模块入口
 * 导出 SQL 和 MongoDB 模型基类
 */

export { SQLModel, ValidationError } from "./sql-model.ts";
export type { Locale, ModelTranslateFn } from "./i18n.ts";
export type {
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  ValidationRule,
  WhereCondition,
} from "./sql-model.ts";

export { MongoModel } from "./mongo-model.ts";
export type { MongoWhereCondition } from "./mongo-model.ts";
