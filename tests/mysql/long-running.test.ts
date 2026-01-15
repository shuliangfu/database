/**
 * @fileoverview MySQL 长时间运行集成测试
 * 测试数据库连接在长时间运行场景下的稳定性
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

describe("MySQL 长时间运行集成测试", () => {
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
        min: 2,
        max: 5,
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS long_running_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        value INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
    );

    await adapter.execute("TRUNCATE TABLE long_running_test", []);
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  it("应该在长时间运行后连接仍然正常", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    // 执行多次操作，模拟长时间运行
    for (let i = 0; i < 50; i++) {
      await adapter.execute(
        "INSERT INTO long_running_test (name, value) VALUES (?, ?)",
        [`Test ${i}`, i],
      );

      // 每隔几次操作检查一次连接状态
      if (i % 10 === 0) {
        expect(adapter.isConnected()).toBe(true);
        const status = await adapter.getPoolStatus();
        expect(status.total).toBeGreaterThanOrEqual(0);
      }

      // 添加小延迟，模拟真实场景
      
    }

    // 最终验证
    const results = await adapter.query(
      "SELECT COUNT(*) as count FROM long_running_test",
      [],
    );
    expect(parseInt(results[0].count)).toBe(50);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在长时间运行后连接池状态正常", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    // 执行大量查询
    for (let i = 0; i < 100; i++) {
      await adapter.query("SELECT 1", []);
    }

    // 检查连接池状态
    const status = await adapter.getPoolStatus();
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.active).toBeLessThanOrEqual(status.total);
    expect(status.idle).toBeLessThanOrEqual(status.total);

    // 连接应该仍然正常
    expect(adapter.isConnected()).toBe(true);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在长时间运行后健康检查正常", async () => {
    if (!adapter) {
      console.log("MySQL not available, skipping test");
      return;
    }

    // 执行一些操作
    for (let i = 0; i < 20; i++) {
      await adapter.query("SELECT 1", []);
    }

    // 执行健康检查
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    if (health.latency !== undefined) {
      expect(health.latency).toBeGreaterThanOrEqual(0);
    }
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
