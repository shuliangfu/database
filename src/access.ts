/**
 * 数据库访问辅助模块
 * 只负责数据库连接的访问，不负责初始化
 * 初始化逻辑请使用 init-database.ts 中的方法
 */

import { $tr } from "./i18n.ts";
import {
  autoInitDatabase,
  closeDatabase as closeDatabaseImpl,
  getDatabaseManager as getManager,
  hasConnection,
  initDatabase,
  isDatabaseInitialized as checkInitialized,
} from "./init-database.ts";
import type { DatabaseManager } from "./manager.ts";
import type { DatabaseAdapter } from "./types.ts";

// 重新导出 initDatabase 以保持向后兼容性（ORM 模型需要）
export { initDatabase };

/**
 * 获取数据库连接（异步版本，支持自动初始化）
 * @param connectionName 连接名称（默认为 'default'）
 * @returns 数据库适配器实例
 * @throws {Error} 如果数据库未初始化且无法自动初始化
 */
export async function getDatabaseAsync(
  connectionName: string = "default",
): Promise<DatabaseAdapter> {
  // 如果数据库未初始化，尝试自动初始化
  if (!checkInitialized() || !hasConnection(connectionName)) {
    await autoInitDatabase(connectionName);
  }

  const dbManager = getManager();
  return dbManager.getConnection(connectionName);
}

/**
 * 获取数据库连接（同步版本）
 * @param connectionName 连接名称（默认为 'default'）
 * @returns 数据库适配器实例
 * @throws {Error} 如果数据库未初始化
 */
export function getDatabase(
  connectionName: string = "default",
): DatabaseAdapter {
  if (!checkInitialized()) {
    throw new Error($tr("error.notInitializedGetDatabase"));
  }

  const dbManager = getManager();
  return dbManager.getConnection(connectionName);
}

/**
 * 获取数据库管理器实例
 * @returns 数据库管理器实例
 * @throws {Error} 如果数据库未初始化
 */
export function getDatabaseManager(): DatabaseManager {
  return getManager();
}

/**
 * 检查数据库是否已初始化
 * @returns 是否已初始化
 */
export function isDatabaseInitialized(): boolean {
  return checkInitialized();
}

/**
 * 关闭所有数据库连接
 * 这是一个便捷方法，实际调用 init-database.ts 中的完整实现
 * 确保所有连接完全关闭，避免连接泄漏
 */
export async function closeDatabase(): Promise<void> {
  // 调用 init-database.ts 中的完整实现，包含所有清理逻辑和等待时间
  await closeDatabaseImpl();
}
