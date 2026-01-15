/**
 * @fileoverview MySQL 故障恢复集成测试
 * 测试数据库连接断开后的自动恢复能力
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("MySQL 故障恢复集成测试", () => {
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
        maxRetries: 3,
        retryDelay: 1000,
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS fault_recovery_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        value INT
      )`,
      [],
    );

    await adapter.execute("TRUNCATE TABLE fault_recovery_test", []);
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  it("应该在连接关闭后能够重新连接", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    // 关闭连接
    await adapter.close();
    expect(adapter.isConnected()).toBe(false);

    // 重新连接
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    await adapter.connect({
      type: "mysql",
      connection: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDatabase,
        username: mysqlUser,
        password: mysqlPassword,
      },
    });

    expect(adapter.isConnected()).toBe(true);

    // 验证可以正常查询
    const results = await adapter.query("SELECT 1", []);
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在查询失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
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
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在事务失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
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
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在多次错误后连接池仍然正常", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
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
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
