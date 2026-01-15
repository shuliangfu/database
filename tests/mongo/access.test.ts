/**
 * @fileoverview 数据库访问辅助函数测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import {
  getDatabase,
  getDatabaseAsync,
  getDatabaseManager,
  initDatabase,
  isDatabaseInitialized,
} from "../../src/access.ts";
import { closeDatabase } from "../../src/init-database.ts";
import type { DatabaseConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("access", () => {
  // 每个测试前清理状态
  beforeEach(async () => {
    await closeDatabase();
    // 等待一小段时间，确保连接完全关闭
    
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("getDatabase", () => {
    it("应该获取数据库连接（同步版本）", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        // MongoDB serverSelectionTimeoutMS 默认是 30 秒，所以设置 35 秒超时
        const initPromise = initDatabase(config);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      const adapter = getDatabase();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 30000 });

    it("应该支持自定义连接名称", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        // MongoDB serverSelectionTimeoutMS 默认是 30 秒，所以设置 35 秒超时
        const initPromise = initDatabase(config, "custom_conn");
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      const adapter = getDatabase("custom_conn");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 35000 });

    it("应该在数据库未初始化时抛出错误", () => {
      expect(() => {
        getDatabase();
      }).toThrow("Database not initialized");
    });

    it("应该提示使用 getDatabaseAsync 进行自动初始化", () => {
      try {
        getDatabase();
      } catch (error) {
        expect((error as Error).message).toContain("getDatabaseAsync");
      }
    });
  });

  describe("getDatabaseAsync", () => {
    it("应该获取数据库连接（异步版本）", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        const initPromise = initDatabase(config);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      const adapter = await getDatabaseAsync();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 30000 });

    it("应该支持自定义连接名称", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        const initPromise = initDatabase(config, "async_conn");
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      const adapter = await getDatabaseAsync("async_conn");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 30000 });

    it("应该在配置加载器未设置时抛出错误", async () => {
      await closeDatabase();

      await assertRejects(
        async () => {
          await getDatabaseAsync();
        },
        Error,
        "Database config loader not set",
      );
    });
  });

  describe("getDatabaseManager", () => {
    it("应该获取数据库管理器实例", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        const initPromise = initDatabase(config);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      const manager = getDatabaseManager();

      expect(manager).toBeTruthy();
      expect(manager.hasConnection("default")).toBe(true);
    }, { timeout: 30000 });

    it("应该在数据库未初始化时抛出错误", async () => {
      await closeDatabase();

      expect(() => {
        getDatabaseManager();
      }).toThrow("Database not initialized");
    });
  });

  describe("isDatabaseInitialized", () => {
    it("应该在数据库未初始化时返回 false", async () => {
      await closeDatabase();

      expect(isDatabaseInitialized()).toBe(false);
    });

    it("应该在数据库初始化后返回 true", async () => {
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      const config: DatabaseConfig = {
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

      try {
        const initPromise = initDatabase(config);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      expect(isDatabaseInitialized()).toBe(true);
    }, { timeout: 30000 });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
