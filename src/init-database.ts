/**
 * 数据库初始化工具
 * 负责所有数据库初始化相关的逻辑，包括 DatabaseManager 的创建和管理
 */

import { $t } from "./i18n.ts";
import type { ConnectionStatus } from "./manager.ts";
import { DatabaseManager } from "./manager.ts";
import type { DatabaseConfig } from "./types.ts";

/**
 * 数据库配置加载器回调函数类型
 */
type DatabaseConfigLoader = () => Promise<DatabaseConfig | null>;

/**
 * 全局数据库管理器实例
 */
let dbManager: DatabaseManager | null = null;

/**
 * 全局数据库配置加载器
 */
let configLoader: DatabaseConfigLoader | null = null;

/**
 * 设置数据库配置加载器
 * @param loader 配置加载器回调函数，返回数据库配置或 null
 */
export function setDatabaseConfigLoader(loader: DatabaseConfigLoader): void {
  configLoader = loader;
}

/**
 * 设置数据库管理器实例
 * @param manager 数据库管理器实例
 */
export function setDatabaseManager(manager: DatabaseManager): void {
  dbManager = manager;
}

/**
 * 初始化数据库连接
 * 这是核心初始化方法，直接接受数据库配置对象
 * 如果数据库管理器已存在，会复用现有的管理器
 *
 * @param config 数据库配置对象
 * @param connectionName 连接名称（默认为 'default'）
 * @returns 连接状态信息
 *
 * @example
 * // 直接使用配置对象初始化
 * await initDatabase({
 *   type: 'sqlite',
 *   connection: { filename: ':memory:' }
 * });
 */
export async function initDatabase(
  config: DatabaseConfig,
  connectionName: string = "default",
): Promise<ConnectionStatus> {
  if (!dbManager) {
    dbManager = new DatabaseManager();
  }

  return await dbManager.connect(connectionName, config);
}

/**
 * 从配置初始化数据库
 * 这是一个便捷方法，用于从框架配置格式中提取数据库配置并初始化
 * 内部调用 initDatabase，功能完全相同，只是参数格式不同
 *
 * @param config 数据库配置（可选，格式：{ database?: DatabaseConfig }）
 * @param connectionName 连接名称（默认为 'default'）
 * @returns 连接状态信息（如果配置存在）
 *
 * @example
 * // 从框架配置格式初始化
 * await initDatabaseFromConfig({
 *   database: {
 *     type: 'sqlite',
 *     connection: { filename: ':memory:' }
 *   }
 * });
 */
export async function initDatabaseFromConfig(
  config?: { database?: DatabaseConfig },
  connectionName: string = "default",
): Promise<ConnectionStatus | void> {
  if (config?.database) {
    // 直接调用 initDatabase，功能完全相同
    return await initDatabase(config.database, connectionName);
  }
}

/**
 * 设置数据库配置加载器（便捷方法）
 * @param loader 配置加载器
 */
export function setupDatabaseConfigLoader(
  loader: () => Promise<DatabaseConfig | null>,
): void {
  setDatabaseConfigLoader(loader);
}

/**
 * 自动从配置加载器获取配置并初始化数据库
 * @param connectionName 连接名称（默认为 'default'）
 */
export async function autoInitDatabase(
  connectionName: string = "default",
): Promise<void> {
  if (!configLoader) {
    throw new Error($t("init.loaderNotSet"));
  }

  const config = await configLoader();
  if (config) {
    await initDatabase(config, connectionName);
  } else {
    throw new Error($t("init.notConfigured"));
  }
}

/**
 * 获取数据库管理器实例
 * @returns 数据库管理器实例
 * @throws {Error} 如果数据库未初始化
 */
export function getDatabaseManager(): DatabaseManager {
  if (!dbManager) {
    throw new Error($t("init.notInitialized"));
  }

  return dbManager;
}

/**
 * 检查数据库是否已初始化
 * @returns 是否已初始化
 */
export function isDatabaseInitialized(): boolean {
  return dbManager !== null;
}

/**
 * 检查数据库是否有指定连接
 * @param connectionName 连接名称（默认为 'default'）
 * @returns 是否有该连接
 */
export function hasConnection(connectionName: string = "default"): boolean {
  return dbManager?.hasConnection(connectionName) ?? false;
}

/**
 * 关闭所有数据库连接
 * 确保所有连接完全关闭，避免连接泄漏
 * 在 Bun 测试环境中，需要更长的等待时间确保连接完全释放
 */
export async function closeDatabase(): Promise<void> {
  if (dbManager) {
    await dbManager.closeAll();
    dbManager = null;
  }
  // 清理配置加载器，避免测试之间的状态污染
  configLoader = null;
}
