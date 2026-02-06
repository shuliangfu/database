/**
 * @fileoverview PostgreSQL 测试共享工具
 * 提供统一的 PostgreSQL 连接配置，支持认证（默认 root/8866231）
 */

import { getEnv } from "@dreamer/runtime-adapter";
import type { DatabaseConfig, PostgreSQLConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 PostgreSQL 测试配置
 * 支持认证，默认账户 root/8866231（可通过 POSTGRES_USER、POSTGRES_PASSWORD 覆盖）
 *
 * @param overrides 可选覆盖项：database 指定数据库名，pool 合并到 pool 配置
 * @returns PostgreSQL 数据库配置
 */
export function createPostgresConfig(
  overrides?: Partial<{
    database: string;
    pool?: Record<string, unknown>;
  }>,
): DatabaseConfig {
  const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
  const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
  const pgDatabase = overrides?.database ??
    getEnvWithDefault("POSTGRES_DATABASE", "postgres");
  const pgUser = getEnvWithDefault("POSTGRES_USER", "root");
  const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "8866231");

  const config: PostgreSQLConfig = {
    adapter: "postgresql",
    connection: {
      host: pgHost,
      port: pgPort,
      database: pgDatabase,
      username: pgUser,
      password: pgPassword,
    },
  };

  if (overrides?.pool) {
    config.pool = {
      ...config.pool,
      ...overrides.pool,
    } as PostgreSQLConfig["pool"];
  }

  return config;
}
