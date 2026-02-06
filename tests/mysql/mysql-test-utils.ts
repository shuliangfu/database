/**
 * @fileoverview MySQL 测试共享工具
 * 提供统一的 MySQL 连接配置，支持认证（默认 root/8866231）
 */

import { getEnv } from "@dreamer/runtime-adapter";
import type { DatabaseConfig, MySQLConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 MySQL 测试配置
 * 支持认证，默认账户 root/8866231（可通过 MYSQL_USER、MYSQL_PASSWORD 覆盖）
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
