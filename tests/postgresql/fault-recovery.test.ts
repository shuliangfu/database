/**
 * @fileoverview PostgreSQL 故障恢复集成测试
 * 测试数据库连接断开后的自动恢复能力
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createPostgresConfig } from "./postgres-test-utils.ts";

describe("PostgreSQL 故障恢复集成测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
      // 等待之前的连接完全释放
    } catch {
      // 忽略清理错误
    }

    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase(
      createPostgresConfig({
        pool: {
          maxRetries: 3,
          retryDelay: 1000,
        },
      }),
    );

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS fault_recovery_test (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        value INTEGER
      )`,
      [],
    );

    await adapter.execute(
      "TRUNCATE TABLE fault_recovery_test RESTART IDENTITY",
      [],
    );
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
      // 等待连接完全释放，特别是在 Bun 测试环境中
    } catch {
      // 忽略关闭错误
    }
  });

  // 每个测试后强制等待连接释放，防止连接泄漏
  afterEach(async () => {
    if (adapter && adapter.isConnected()) {
      try {
        // 等待连接池释放空闲连接

        // 获取连接池状态并检查
        const status = await adapter.getPoolStatus();
        // 如果活跃连接过多，等待更长时间
        if (status.active > 2) {
        }
      } catch {
        // 忽略错误
      }
    }
  });

  it("应该在连接关闭后能够重新连接", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 关闭连接
    await adapter.close();
    expect(adapter.isConnected()).toBe(false);

    // 重新连接
    await adapter.connect(createPostgresConfig());

    expect(adapter.isConnected()).toBe(true);

    // 验证可以正常查询
    const results = await adapter.query("SELECT 1", []);
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该在查询失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 执行一个会失败的查询
    try {
      await adapter.query("SELECT * FROM nonexistent_table_12345", []);
    } catch (error) {
      // 预期会失败
      expect(error).toBeInstanceOf(Error);
    }

    // 验证连接仍然正常
    expect(adapter.isConnected()).toBe(true);

    // 验证可以继续执行正常查询
    const results = await adapter.query("SELECT 1", []);
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该在事务失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 执行一个会失败的事务
    try {
      await adapter.transaction(async (db) => {
        await db.execute(
          "INSERT INTO fault_recovery_test (name, value) VALUES (?, ?)",
          ["Test", 1],
        );
        // 故意抛出错误
        throw new Error("Transaction error");
      });
    } catch (error) {
      // 预期会失败
      expect(error).toBeInstanceOf(Error);
    }

    // 验证连接仍然正常
    expect(adapter.isConnected()).toBe(true);

    // 验证可以继续执行正常操作
    const results = await adapter.query("SELECT 1", []);
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该在多次错误后连接池仍然正常", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 执行多次会失败的操作
    for (let i = 0; i < 5; i++) {
      try {
        await adapter.query("SELECT * FROM nonexistent_table_12345", []);
      } catch {
        // 忽略错误
      }
    }

    // 检查连接池状态
    const status = await adapter.getPoolStatus();
    expect(status).toBeTruthy();
    expect(status.total).toBeGreaterThanOrEqual(0);

    // 验证可以继续执行正常查询
    const results = await adapter.query("SELECT 1", []);
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
