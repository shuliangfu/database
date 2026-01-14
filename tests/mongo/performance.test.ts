/**
 * @fileoverview MongoDB 性能测试
 * 测试 MongoDB 适配器在高负载下的性能表现
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
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("MongoDB 性能测试", () => {
  let adapter: MongoDBAdapter;

  beforeAll(async () => {
    adapter = new MongoDBAdapter();
    const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
    const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
    const mongoDatabase = getEnvWithDefault(
      "MONGODB_DATABASE",
      "test_mongodb_perf",
    );
    const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
    const directConnection = getEnvWithDefault(
      "MONGODB_DIRECT_CONNECTION",
      "true",
    ) === "true";

    try {
      await adapter.connect({
        type: "mongodb",
        connection: {
          host: mongoHost,
          port: mongoPort,
          database: mongoDatabase,
        },
        mongoOptions: {
          replicaSet: replicaSet,
          directConnection: directConnection,
        },
      });
    } catch (error) {
      console.warn(
        `MongoDB not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    if (adapter) {
      try {
        const db = adapter.getDatabase();
        if (db) {
          await db.collection("test_perf_data").drop().catch(() => {});
        }
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    const db = adapter.getDatabase();
    if (db) {
      await db.collection("test_perf_data").deleteMany({});
    }
  });

  describe("并发查询性能", () => {
    it("应该能够处理大量并发查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      const documents = Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`,
        value: i + 1,
      }));

      await adapter.execute("insertMany", "test_perf_data", documents);

      // 执行大量并发查询
      const startTime = Date.now();
      const promises = Array.from(
        { length: 100 },
        (_, i) => adapter.query("test_perf_data", { value: i + 1 }),
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池性能", () => {
    it("应该能够快速执行查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.query("test_perf_data", {});
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(100); // 平均每次查询应该在100ms内
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务性能", () => {
    it("应该能够快速执行事务", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const iterations = 20;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await adapter.transaction(async (db) => {
          await db.execute("insert", "test_perf_data", {
            name: `TX User ${i}`,
            email: `tx${i}@test.com`,
            value: i,
          });
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
        console.log("MongoDB not available, skipping test");
        return;
      }

      const batchSize = 1000;
      const startTime = Date.now();

      const documents = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${i + 1}`,
        email: `batch${i + 1}@test.com`,
        value: i + 1,
      }));

      await adapter.execute("insertMany", "test_perf_data", documents);

      const duration = Date.now() - startTime;

      const count = await adapter.query("test_perf_data", {});
      expect(count.length).toBeGreaterThanOrEqual(batchSize);
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该能够处理大量数据的查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入大量数据
      const documents = Array.from({ length: 5000 }, (_, i) => ({
        name: `Query User ${i + 1}`,
        email: `query${i + 1}@test.com`,
        value: i + 1,
      }));

      await adapter.execute("insertMany", "test_perf_data", documents);

      const startTime = Date.now();
      const results = await adapter.query("test_perf_data", {
        value: { $gt: 1000, $lt: 2000 },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBe(999);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
