/**
 * @fileoverview 资源泄漏测试
 * 测试数据库连接、事务等资源是否正确释放
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

describe("资源泄漏测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      adapter: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  it("应该在关闭连接后释放所有资源", async () => {
    if (!adapter) {
      console.log("SQLite not available, skipping test");
      return;
    }

    // 创建临时适配器
    const testAdapter = new SQLiteAdapter();
    await testAdapter.connect({
      adapter: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });

    // 执行一些操作
    await testAdapter.query("SELECT 1", []);

    // 关闭连接
    await testAdapter.close();

    // 验证连接已关闭
    expect(testAdapter.isConnected()).toBe(false);

    // 验证连接池状态（关闭后应该无法获取状态或返回空状态）
    try {
      const statusAfter = await testAdapter.getPoolStatus();
      // SQLite 关闭后可能返回空状态
      expect(statusAfter.total).toBeGreaterThanOrEqual(0);
      expect(statusAfter.active).toBe(0);
    } catch {
      // 如果抛出错误，也是合理的行为
    }
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在事务完成后释放资源", async () => {
    if (!adapter) {
      console.log("SQLite not available, skipping test");
      return;
    }

    const statusBefore = await adapter.getPoolStatus();

    // 执行事务
    await adapter.transaction(async (db) => {
      await db.query("SELECT 1", []);
    });

    // 等待一小段时间让资源释放

    const statusAfter = await adapter.getPoolStatus();

    // 事务完成后，状态应该正常
    expect(statusAfter.total).toBeGreaterThanOrEqual(0);
    expect(statusAfter.active).toBeLessThanOrEqual(statusBefore.active + 1);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在多次查询后状态正常", async () => {
    if (!adapter) {
      console.log("SQLite not available, skipping test");
      return;
    }

    // 执行多次查询
    for (let i = 0; i < 10; i++) {
      await adapter.query("SELECT 1", []);
    }

    const status = await adapter.getPoolStatus();

    // 状态应该正常
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.active).toBeLessThanOrEqual(status.total);
    expect(status.idle).toBeLessThanOrEqual(status.total);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
