/**
 * @fileoverview 数据库访问辅助函数测试
 *
 * 依赖本机 MySQL 及默认库 `test` 已创建；不可连时跳过需连接的用例（见 mysql-test-utils.ts）。
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
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
import { createMysqlConfig, probeMysqlAvailable } from "./mysql-test-utils.ts";

describe("access", () => {
  /** 本机 MySQL 是否可用（含默认库是否存在）；false 时跳过需 initDatabase 的用例 */
  let mysqlAvailable = false;

  beforeAll(async () => {
    mysqlAvailable = await probeMysqlAvailable();
    if (!mysqlAvailable) {
      console.warn(
        "[mysql access tests] 跳过需连接数据库的用例：无法连接 MySQL。请确认 mysqld 已启动，并已执行 CREATE DATABASE IF NOT EXISTS test;（或设置 MYSQL_DATABASE 指向已有库）。详见 tests/mysql/mysql-test-utils.ts",
      );
    }
  });

  // 每个测试前清理状态
  beforeEach(async () => {
    await closeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("getDatabase", () => {
    it("应该获取数据库连接（同步版本）", async () => {
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig());
      const adapter = getDatabase();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig(), "custom_conn");
      const adapter = getDatabase("custom_conn");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

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
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig());
      const adapter = await getDatabaseAsync();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig(), "async_conn");
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
        /Database config loader not set|数据库配置加载器未设置/,
      );
    });
  });

  describe("getDatabaseManager", () => {
    it("应该获取数据库管理器实例", async () => {
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig());
      const manager = getDatabaseManager();

      expect(manager).toBeTruthy();
      expect(manager.hasConnection("default")).toBe(true);
    });

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
      if (!mysqlAvailable) return;
      await initDatabase(createMysqlConfig());

      expect(isDatabaseInitialized()).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
