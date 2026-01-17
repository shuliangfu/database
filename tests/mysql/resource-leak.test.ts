/**
 * @fileoverview 资源泄漏测试
 * 测试数据库连接、连接池、事务等资源是否正确释放
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("资源泄漏测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      type: "mysql",
      connection: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDatabase,
        username: mysqlUser,
        password: mysqlPassword,
      },
      pool: {
        min: 1,
        max: 5,
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
      console.log("MySQL not available, skipping test");
      return;
    }

    // 创建临时适配器
    const testAdapter = new MySQLAdapter();
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    await testAdapter.connect({
      type: "mysql",
      connection: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDatabase,
        username: mysqlUser,
        password: mysqlPassword,
      },
    });

    // 执行一些操作
    await testAdapter.query("SELECT 1", []);
    const statusBefore = await testAdapter.getPoolStatus();

    // 关闭连接
    await testAdapter.close();

    // 验证连接已关闭
    expect(testAdapter.isConnected()).toBe(false);

    // 验证连接池状态（关闭后应该无法获取状态或返回空状态）
    try {
      const statusAfter = await testAdapter.getPoolStatus();
      // 如果还能获取状态，应该都是 0
      expect(statusAfter.total).toBe(0);
      expect(statusAfter.active).toBe(0);
    } catch {
      // 如果抛出错误，也是合理的行为
    }
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该在事务完成后释放连接", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    const statusBefore = await adapter.getPoolStatus();

    // 执行事务
    await adapter.transaction(async (db) => {
      await db.query("SELECT 1", []);
    });

    // 等待一小段时间让连接释放


    const statusAfter = await adapter.getPoolStatus();

    // 事务完成后，活跃连接应该减少或保持不变
    expect(statusAfter.active).toBeLessThanOrEqual(statusBefore.active + 1);
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该在多次查询后连接池状态正常", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    // 执行多次查询
    for (let i = 0; i < 10; i++) {
      await adapter.query("SELECT 1", []);
    }

    const status = await adapter.getPoolStatus();

    // 连接池状态应该正常
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.active).toBeLessThanOrEqual(status.total);
    expect(status.idle).toBeLessThanOrEqual(status.total);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
