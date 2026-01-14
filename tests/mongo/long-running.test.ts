/**
 * @fileoverview MongoDB 长时间运行集成测试
 * 测试数据库连接在长时间运行场景下的稳定性
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 MongoDB 配置
 */
function createMongoConfig() {
  const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
  const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
  const mongoDatabase = getEnvWithDefault(
    "MONGODB_DATABASE",
    "test_long_running",
  );
  const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
  const directConnection = getEnvWithDefault(
    "MONGODB_DIRECT_CONNECTION",
    "true",
  ) === "true";

  return {
    type: "mongodb" as const,
    connection: {
      host: mongoHost,
      port: mongoPort,
      database: mongoDatabase,
    },
    mongoOptions: {
      replicaSet: replicaSet,
      directConnection: directConnection,
    },
  };
}

describe("MongoDB 长时间运行集成测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = new MongoDBAdapter();
    const config = createMongoConfig();

    await adapter.connect(config);
  });

  afterAll(async () => {
    // 清理测试数据
    if (adapter) {
      try {
        const db = (adapter as MongoDBAdapter).getDatabase();
        if (db) {
          await db.collection("long_running_test").deleteMany({});
        }
        await adapter.close();
      } catch {
        // 忽略错误
      }
    }
  });

  it("应该在长时间运行后连接仍然正常", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    const db = (adapter as MongoDBAdapter).getDatabase();
    if (!db) {
      console.log("MongoDB database not available, skipping test");
      return;
    }

    // 清理之前的数据
    await db.collection("long_running_test").deleteMany({});

    // 执行多次操作，模拟长时间运行
    for (let i = 0; i < 50; i++) {
      await db.collection("long_running_test").insertOne({
        name: `Test ${i}`,
        value: i,
        created_at: new Date(),
      });

      // 每隔几次操作检查一次连接状态
      if (i % 10 === 0) {
        expect(adapter.isConnected()).toBe(true);
        const status = await adapter.getPoolStatus();
        expect(status.total).toBeGreaterThanOrEqual(0);
      }

      // 添加小延迟，模拟真实场景
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // 最终验证
    const count = await db.collection("long_running_test").countDocuments();
    expect(count).toBe(50);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在长时间运行后连接池状态正常", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 执行大量查询
    for (let i = 0; i < 100; i++) {
      await adapter.query("find", {
        collection: "long_running_test",
        filter: {},
        options: { limit: 1 },
      });
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
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 执行一些操作
    for (let i = 0; i < 20; i++) {
      await adapter.query("find", {
        collection: "long_running_test",
        filter: {},
        options: { limit: 1 },
      });
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
