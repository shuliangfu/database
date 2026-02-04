/**
 * @fileoverview MongoDB 测试共享工具
 * 提供统一的 MongoDB 连接配置，支持认证（默认 root/8866231）
 */

import { getEnv } from "@dreamer/runtime-adapter";
import type { DatabaseConfig, MongoConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 MongoDB 测试配置
 * 支持认证，默认账户 root/8866231（可通过 MONGODB_USER、MONGODB_PASSWORD 覆盖）
 *
 * @param overrides 可选覆盖项：database 指定数据库名，mongoOptions 合并到 mongoOptions
 * @returns MongoDB 数据库配置
 */
export function createMongoConfig(
  overrides?: Partial<{
    database: string;
    mongoOptions?: Record<string, unknown>;
  }>,
): DatabaseConfig {
  const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
  const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
  const mongoDatabase = overrides?.database ??
    getEnvWithDefault("MONGODB_DATABASE", "test");
  const mongoUser = getEnvWithDefault("MONGODB_USER", "root");
  const mongoPassword = getEnvWithDefault("MONGODB_PASSWORD", "8866231");
  const authSource = getEnvWithDefault("MONGODB_AUTH_SOURCE", "admin");
  const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
  const directConnection = getEnvWithDefault(
    "MONGODB_DIRECT_CONNECTION",
    "true",
  ) === "true";

  const config: MongoConfig = {
    type: "mongodb",
    connection: {
      host: mongoHost,
      port: mongoPort,
      database: mongoDatabase,
    },
    mongoOptions: {
      replicaSet: replicaSet,
      directConnection: directConnection,
    },
  };

  // 仅当配置了用户名和密码时添加认证（支持无认证环境：设置 MONGODB_USER="" 覆盖）
  if (mongoUser && mongoPassword) {
    config.connection.username = mongoUser;
    config.connection.password = mongoPassword;
    config.connection.authSource = authSource;
    config.mongoOptions = config.mongoOptions ?? {};
    config.mongoOptions.authSource = authSource;
  }

  // 合并 mongoOptions 覆盖项（如 maxPoolSize）
  if (overrides?.mongoOptions) {
    config.mongoOptions = { ...config.mongoOptions, ...overrides.mongoOptions };
  }

  return config;
}
