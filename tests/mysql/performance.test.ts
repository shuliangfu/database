/**
 * @fileoverview MySQL/MariaDB 性能测试
 * 测试 MySQL/MariaDB 适配器在高负载下的性能表现
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeAll,
  beforeEach,
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

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_NAME = "mysql_performance_test_perf_data";

describe("MySQL/MariaDB 性能测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    try {
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
      });

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();
    } catch (error) {
      console.warn(
        `MySQL not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    try {
      await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_NAME}`, []);
      await adapter.execute(
        `CREATE TABLE ${TABLE_NAME} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          value INT
        )`,
        [],
      );
    } catch {
      // 忽略错误
    }
  });

  describe("并发查询性能", () => {
    it("应该能够处理大量并发查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      // 插入测试数据
      for (let i = 1; i <= 100; i++) {
        await adapter.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, value) VALUES (?, ?, ?)`,
          [`User ${i}`, `user${i}@test.com`, i],
        );
      }

      // 执行大量并发查询
      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, (_, i) =>
        adapter.query(
          `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
          [i + 1],
        ));

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池性能", () => {
    it("应该能够快速获取和释放连接", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.query("SELECT 1", []);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(100); // 平均每次查询应该在100ms内
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务性能", () => {
    it("应该能够快速执行事务", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const iterations = 20;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.transaction(async (db) => {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, value) VALUES (?, ?, ?)`,
            [`TX User ${i}`, `tx${i}@test.com`, i],
          );
        });
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(200); // 平均每个事务应该在200ms内
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("大数据量操作", () => {
    it("应该能够处理大量数据的插入", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const batchSize = 1000;
      const startTime = Date.now();

      await adapter.transaction(async (db) => {
        for (let i = 1; i <= batchSize; i++) {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, value) VALUES (?, ?, ?)`,
            [`Batch User ${i}`, `batch${i}@test.com`, i],
          );
        }
      });

      const duration = Date.now() - startTime;

      const count = await adapter.query(
        `SELECT COUNT(*) as count FROM ${TABLE_NAME}`,
        [],
      );

      expect(parseInt(count[0].count)).toBeGreaterThanOrEqual(batchSize);
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该能够处理大量数据的查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      // 先插入大量数据
      await adapter.transaction(async (db) => {
        for (let i = 1; i <= 5000; i++) {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, value) VALUES (?, ?, ?)`,
            [`Query User ${i}`, `query${i}@test.com`, i],
          );
        }
      });

      const startTime = Date.now();
      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE value > ? AND value < ?`,
        [1000, 2000],
      );
      const duration = Date.now() - startTime;

      expect(results.length).toBe(999);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
