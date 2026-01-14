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
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("getDatabase", () => {
    it("应该获取数据库连接（同步版本）", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config);
      const adapter = getDatabase();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config, "custom_conn");
      const adapter = getDatabase("custom_conn");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

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
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config);
      const adapter = await getDatabaseAsync();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config, "async_conn");
      const adapter = await getDatabaseAsync("async_conn");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

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
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config);
      const manager = getDatabaseManager();

      expect(manager).toBeTruthy();
      expect(manager.hasConnection("default")).toBe(true);
    });

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
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await initDatabase(config);

      expect(isDatabaseInitialized()).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
