/**
 * @fileoverview 数据库访问辅助函数用例工厂
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
} from "../../../src/access.ts";
import { closeDatabase } from "../../../src/init-database.ts";
import { probeMysqlAvailable } from "../configs.ts";
import type { EngineFixture } from "../fixture.ts";

export function registerAccessTests(fx: EngineFixture): void {
  const describeBody = () => {
    let mysqlAvailable = fx.kind !== "mysql";

    if (fx.kind === "mysql") {
      beforeAll(async () => {
        mysqlAvailable = await probeMysqlAvailable();
        if (!mysqlAvailable) {
          console.warn(
            "[mysql access tests] 跳过需连接数据库的用例：无法连接 MySQL。请确认 mysqld 已启动，并已执行 CREATE DATABASE IF NOT EXISTS test;（或设置 MYSQL_DATABASE 指向已有库）。详见 tests/mysql/mysql-test-utils.ts",
          );
        }
      });
    }

    // 每个测试前清理状态
    beforeEach(async () => {
      await closeDatabase();
    });

    afterAll(async () => {
      await closeDatabase();
    });

    async function initOrSkip(name?: string): Promise<boolean> {
      if (fx.kind === "mysql" && !mysqlAvailable) return false;
      if (fx.kind !== "mongodb") {
        if (name) {
          await initDatabase(fx.createConfig(), name);
        } else {
          await initDatabase(fx.createConfig());
        }
        return true;
      }
      try {
        const initPromise = name
          ? initDatabase(fx.createConfig(), name)
          : initDatabase(fx.createConfig());
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 35000)
        );
        await Promise.race([initPromise, timeoutPromise]);
        return true;
      } catch (error) {
        console.warn(
          `MongoDB not available, skipping test: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    }

    const connectingOpts = fx.kind === "mongodb"
      ? { timeout: 30000 }
      : undefined;

    describe("getDatabase", () => {
      it("应该获取数据库连接（同步版本）", async () => {
        if (!await initOrSkip()) return;
        const adapter = getDatabase();

        expect(adapter).toBeTruthy();
        expect(adapter.isConnected()).toBe(true);
      }, connectingOpts as any);

      it("应该支持自定义连接名称", async () => {
        if (!await initOrSkip("custom_conn")) return;
        const adapter = getDatabase("custom_conn");

        expect(adapter).toBeTruthy();
        expect(adapter.isConnected()).toBe(true);
      }, connectingOpts as any);

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
        if (!await initOrSkip()) return;
        const adapter = await getDatabaseAsync();

        expect(adapter).toBeTruthy();
        expect(adapter.isConnected()).toBe(true);
      }, connectingOpts as any);

      it("应该支持自定义连接名称", async () => {
        if (!await initOrSkip("async_conn")) return;
        const adapter = await getDatabaseAsync("async_conn");

        expect(adapter).toBeTruthy();
        expect(adapter.isConnected()).toBe(true);
      }, connectingOpts as any);

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
        if (!await initOrSkip()) return;
        const manager = getDatabaseManager();

        expect(manager).toBeTruthy();
        expect(manager.hasConnection("default")).toBe(true);
      }, connectingOpts as any);

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
        if (!await initOrSkip()) return;
        expect(isDatabaseInitialized()).toBe(true);
      }, connectingOpts as any);
    });
  };

  if (fx.kind === "sqlite") {
    describe("access", describeBody);
  } else {
    describe("access", describeBody, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  }
}
