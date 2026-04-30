/**
 * @fileoverview MySQL 测试共享工具
 * 提供统一的 MySQL 连接配置。
 *
 * ## 与本机 mysql 客户端对齐的默认值
 * 等价于：`mysql -h 127.0.0.1 -P 3306 -uroot -p`，密码等参数见环境变量或下方默认值。
 *
 * ## 运行集成测试前请确认
 * 1. MySQL 已在 `MYSQL_HOST`:`MYSQL_PORT`（默认 `127.0.0.1:3306`）监听。
 * 2. **必须先存在默认库**：`CREATE DATABASE IF NOT EXISTS test;`，或通过环境变量指定已有库名：`MYSQL_DATABASE=mydb`。
 *    若未建库，驱动会报 Unknown database，适配器重试约数次后失败（单次用例可能表现为 FAILED ~6s）。
 * 3. 可选覆盖：`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`。
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { initDatabase } from "../../src/access.ts";
import { closeDatabase } from "../../src/init-database.ts";
import type { DatabaseConfig, MySQLConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 MySQL 测试配置
 * 支持认证，默认 `MYSQL_HOST=127.0.0.1`、`MYSQL_USER=root`、密码见 `MYSQL_PASSWORD` 默认值（可通过环境变量覆盖）
 *
 * @param overrides 可选覆盖项：database 指定数据库名，pool 合并到 pool 配置
 * @returns MySQL 数据库配置
 */
export function createMysqlConfig(
  overrides?: Partial<{
    database: string;
    pool?: Record<string, unknown>;
  }>,
): DatabaseConfig {
  const mysqlHost = getEnvWithDefault("MYSQL_HOST", "127.0.0.1");
  const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
  const mysqlDatabase = overrides?.database ??
    getEnvWithDefault("MYSQL_DATABASE", "test");
  const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
  const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "8866231");

  const config: MySQLConfig = {
    adapter: "mysql",
    connection: {
      host: mysqlHost,
      port: mysqlPort,
      database: mysqlDatabase,
      username: mysqlUser,
      password: mysqlPassword,
    },
  };

  if (overrides?.pool) {
    config.pool = { ...config.pool, ...overrides.pool } as MySQLConfig["pool"];
  }

  return config;
}

/**
 * 探测本机 MySQL 是否可连（默认库需已存在）。
 * 用于 `access.test.ts` 等在无数据库时跳过集成用例，避免长时间重试。
 * `pool.maxRetries: 0` 失败即返回，不重复排队等待。
 */
export async function probeMysqlAvailable(): Promise<boolean> {
  try {
    await initDatabase(
      createMysqlConfig({
        pool: { maxRetries: 0, retryDelay: 100 },
      }),
    );
    await closeDatabase();
    return true;
  } catch {
    await closeDatabase().catch(() => {});
    return false;
  }
}
