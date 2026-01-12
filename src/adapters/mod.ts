/**
 * 数据库适配器模块导出
 */

export { BaseAdapter } from "./base.ts";
export type { HealthCheckResult, PoolStatus, QueryLogger } from "./base.ts";

// 适配器实现
export { MongoDBAdapter } from "./mongodb.ts";
export { MySQLAdapter } from "./mysql.ts";
export { PostgreSQLAdapter } from "./postgresql.ts";
export { SQLiteAdapter } from "./sqlite.ts";
