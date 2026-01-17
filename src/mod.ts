/**
 * 数据库功能模块入口
 * 导出所有数据库相关的公共 API
 *
 * @module
 */

// ==================== 管理器 ====================
export { DatabaseManager } from "./manager.ts";
export type { ConnectionStatus } from "./manager.ts";

// ==================== 核心类型 ====================
export type { DatabaseAdapter, DatabaseConfig, DatabaseType } from "./types.ts";

// ==================== 适配器 ====================
export type { HealthCheckResult, PoolStatus } from "./adapters/base.ts";
export {
  BaseAdapter,
  MongoDBAdapter,
  MySQLAdapter,
  PostgreSQLAdapter,
  SQLiteAdapter,
} from "./adapters/mod.ts";

// ==================== 查询构建器 ====================
export { MongoQueryBuilder, SQLQueryBuilder } from "./query/mod.ts";

// ==================== ORM/ODM 模型 ====================
export { MongoModel, SQLModel, ValidationError } from "./orm/mod.ts";
export type {
  FieldDefinition,
  FieldType,
  LifecycleHook,
  ModelSchema,
  MongoWhereCondition,
  ValidationRule,
  WhereCondition,
} from "./orm/mod.ts";

// ==================== 迁移管理 ====================
export { MigrationManager } from "./migration/mod.ts";
export type {
  Migration,
  MigrationConfig,
  MigrationStatus,
} from "./migration/mod.ts";

// ==================== 缓存 ====================
export type { CacheAdapter } from "./cache/cache-adapter.ts";
export { MemoryCacheAdapter } from "./cache/memory-cache.ts";
// 导出 @dreamer/cache 的其他功能
export { CacheManager, MemoryAdapter, MultiLevelCache } from "@dreamer/cache";
export type { CacheStrategy } from "@dreamer/cache";

// ==================== 查询日志 ====================
export { QueryLogger } from "./logger/query-logger.ts";
export type {
  QueryLogEntry,
  QueryLoggerConfig,
} from "./logger/query-logger.ts";

// ==================== 索引类型 ====================
export type {
  CompoundIndex,
  GeospatialIndex,
  IndexDefinition,
  IndexDefinitions,
  IndexDirection,
  IndexType,
  SingleFieldIndex,
  TextIndex,
} from "./types/index.ts";

// ==================== 错误处理 ====================
export {
  createConfigError,
  createConnectionError,
  createExecuteError,
  createQueryError,
  createTransactionError,
  DatabaseError,
  DatabaseErrorCode,
} from "./errors.ts";
export type { DatabaseError as DatabaseErrorType } from "./errors.ts";

// ==================== 数据库访问辅助函数 ====================
export {
  closeDatabase,
  getDatabase,
  getDatabaseAsync,
  getDatabaseManager,
  isDatabaseInitialized,
} from "./access.ts";

// ==================== 数据库初始化工具 ====================
export {
  autoInitDatabase,
  initDatabase,
  initDatabaseFromConfig,
  setDatabaseConfigLoader,
  setDatabaseManager,
  setupDatabaseConfigLoader,
} from "./init-database.ts";
