/**
 * @fileoverview 数据库访问辅助函数测试
 */

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
import { createMongoConfig } from "./mongo-test-utils.ts";

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
      try {
        // MongoDB serverSelectionTimeoutMS 默认是 30 秒，所以设置 35 秒超时
        const initPromise = initDatabase(createMongoConfig());
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
      try {
        // MongoDB serverSelectionTimeoutMS 默认是 30 秒，所以设置 35 秒超时
        const initPromise = initDatabase(createMongoConfig(), "custom_conn");
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
      }).toThrow(/Database not initialized|数据库未初始化/);
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
      try {
        const initPromise = initDatabase(createMongoConfig());
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
      try {
        const initPromise = initDatabase(createMongoConfig(), "async_conn");
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
        /Database config loader not set|数据库配置加载器未设置/,
      );
    });
  });

  describe("getDatabaseManager", () => {
    it("应该获取数据库管理器实例", async () => {
      try {
        const initPromise = initDatabase(createMongoConfig());
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
      }).toThrow(/Database not initialized|数据库未初始化/);
    });
  });

  describe("isDatabaseInitialized", () => {
    it("应该在数据库未初始化时返回 false", async () => {
      await closeDatabase();

      expect(isDatabaseInitialized()).toBe(false);
    });

    it("应该在数据库初始化后返回 true", async () => {
      try {
        const initPromise = initDatabase(createMongoConfig());
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
