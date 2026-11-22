/**
 * ORM 共享层入口：校验、钩子合并、缓存键、虚拟字段、软删与关联骨架。
 */

export type {
  CacheQueryOptions,
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  TimestampsConfig,
  ValidationRule,
  WhenCondition,
} from "./types.ts";
export { ValidationError } from "./types.ts";

export {
  applyCreateTimestamps,
  applyUpdateTimestamp,
  assignHookChangesIfChanged,
  hasObjectChanged,
  mergeCreateManyHookFields,
  mergeUpdateHookFields,
  runHookAndMergeIfChanged,
} from "./hooks.ts";

export { applyVirtuals, getSchemaKeys, getVirtuals } from "./schema.ts";

export {
  clearModelCache,
  generateModelCacheKey,
  serializeCacheKeyParams,
} from "./cache-keys.ts";

export type { ValidationDialect, ValidationHost } from "./validation.ts";
export {
  checkType,
  checkWhenCondition,
  validateArray,
  validateCompareValue,
  validateExists,
  validateFieldAsync,
  validateFormat,
  validateMongoField,
  validateNotExists,
  validateRecord,
  validateSqlField,
  validateUnique,
} from "./validation.ts";

export type { SoftDeleteScope } from "./soft-delete.ts";
export {
  appendSqlSoftDeleteCondition,
  applyMongoSoftDeleteFilter,
  resolveSoftDeleteScope,
} from "./soft-delete.ts";

export type {
  PreloadRelations,
  PreloadRelationType,
  PreloadSpec,
  RelatedFindAllModel,
  RelatedFindModel,
} from "./relations.ts";
export {
  applyPreloads,
  belongsToManyRelated,
  belongsToRelated,
  hasManyRelated,
  hasOneRelated,
  mergePreloadFields,
  preloadParentKeys,
  preloadRelations,
  serializePreloadSignature,
} from "./relations.ts";
export type { QueryRecord } from "./relations.ts";

export { lazyThenable } from "./lazy-thenable.ts";
export type { LazyThenable } from "./lazy-thenable.ts";

export {
  asModelId,
  assignData,
  getRecordValue,
  isForbiddenKey,
  setRecordValue,
} from "./safe-assign.ts";

export {
  assertSafeMongoValue,
  DANGEROUS_MONGO_OPERATORS,
  UnsafeMongoFieldError,
  UnsafeMongoOperatorError,
} from "./mongo-sanitize.ts";

export {
  appendGroupByHaving,
  formatAggregateSelect,
  InvalidSqlAggregateError,
  normalizeGroupBy,
} from "./sql-group.ts";
export type { SqlAggregates, SqlHaving } from "./sql-group.ts";

export {
  asExecuteResult,
  readAffectedRows,
  readInsertedIdAt,
  readInsertedIds,
  readInsertId,
  readNumericField,
  readResultRows,
} from "./execute-result.ts";
export type { SqlExecuteResult } from "./execute-result.ts";
