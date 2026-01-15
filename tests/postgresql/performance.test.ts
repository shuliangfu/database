/**
 * @fileoverview PostgreSQL 性能测试
 * 测试 PostgreSQL 适配器在高负载下的性能表现
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
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

describe("PostgreSQL 性能测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
    } catch {
      // 忽略清理错误
    }

    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase({
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      });

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();
    } catch (error) {
      console.warn(
        `PostgreSQL not available, skipping tests: ${
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

  // 每个测试后强制等待连接释放，防止连接泄漏
  afterEach(async () => {
    if (adapter && adapter.isConnected()) {
      try {
        // 获取连接池状态并检查（已移除延时以提升测试速度）
        const status = await adapter.getPoolStatus();
        // 如果活跃连接过多，记录警告但不等待
        if (status.active > 2) {
          console.warn(`警告：连接池中有 ${status.active} 个活跃连接`);
        }
      } catch {
        // 忽略错误
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    try {
      await adapter.execute("DROP TABLE IF EXISTS test_perf_data", []);
      await adapter.execute(
        `CREATE TABLE test_perf_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          value INTEGER
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
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      // 插入测试数据
      for (let i = 1; i <= 100; i++) {
        await adapter.execute(
          "INSERT INTO test_perf_data (name, email, value) VALUES ($1, $2, $3)",
          [`User ${i}`, `user${i}@test.com`, i],
        );
      }

      // 执行大量并发查询
      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, (_, i) =>
        adapter.query(
          "SELECT * FROM test_perf_data WHERE id = $1",
          [i + 1],
        ));

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("连接池性能", () => {
    it("应该能够快速获取和释放连接", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
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
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("事务性能", () => {
    it("应该能够快速执行事务", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const iterations = 20;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.transaction(async (db) => {
          await db.execute(
            "INSERT INTO test_perf_data (name, email, value) VALUES ($1, $2, $3)",
            [`TX User ${i}`, `tx${i}@test.com`, i],
          );
        });
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(200); // 平均每个事务应该在200ms内
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("大数据量操作", () => {
    it("应该能够处理大量数据的插入", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const batchSize = 1000;
      const startTime = Date.now();

      await adapter.transaction(async (db) => {
        for (let i = 1; i <= batchSize; i++) {
          await db.execute(
            "INSERT INTO test_perf_data (name, email, value) VALUES ($1, $2, $3)",
            [`Batch User ${i}`, `batch${i}@test.com`, i],
          );
        }
      });

      const duration = Date.now() - startTime;

      const count = await adapter.query(
        "SELECT COUNT(*) as count FROM test_perf_data",
        [],
      );

      expect(parseInt(count[0].count)).toBeGreaterThanOrEqual(batchSize);
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该能够处理大量数据的查询", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      // 先插入大量数据
      await adapter.transaction(async (db) => {
        for (let i = 1; i <= 5000; i++) {
          await db.execute(
            "INSERT INTO test_perf_data (name, email, value) VALUES ($1, $2, $3)",
            [`Query User ${i}`, `query${i}@test.com`, i],
          );
        }
      });

      const startTime = Date.now();
      const results = await adapter.query(
        "SELECT * FROM test_perf_data WHERE value > $1 AND value < $2",
        [1000, 2000],
      );
      const duration = Date.now() - startTime;

      expect(results.length).toBe(999);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
