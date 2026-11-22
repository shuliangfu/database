/**
 * @fileoverview 各库测试连接配置（默认值与原 *test-utils 保持一致）
 */

import { closeDatabase, initDatabase } from "../../src/access.ts";
import type {
  DatabaseConfig,
  MongoConfig,
  MySQLConfig,
  PostgreSQLConfig,
} from "../../src/types.ts";
import { getEnvWithDefault } from "./env.ts";

export function createSqliteConfig(
  overrides?: { filename?: string },
): DatabaseConfig {
  return {
    adapter: "sqlite",
    connection: {
      filename: overrides?.filename ??
        getEnvWithDefault("SQLITE_PATH", ":memory:"),
    },
  };
}

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

/** 探测本机 MySQL 是否可连（默认库需已存在）。失败即返回，不重复排队等待。 */
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
    adapter: "mongodb",
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

  if (mongoUser && mongoPassword) {
    config.connection.username = mongoUser;
    config.connection.password = mongoPassword;
    config.connection.authSource = authSource;
    config.mongoOptions = config.mongoOptions ?? {};
    config.mongoOptions.authSource = authSource;
  }

  if (overrides?.mongoOptions) {
    config.mongoOptions = { ...config.mongoOptions, ...overrides.mongoOptions };
  }

  return config;
}
