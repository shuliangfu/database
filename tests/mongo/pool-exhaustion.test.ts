/**
 * @fileoverview MongoDB 连接池耗尽测试
 * 测试连接池在达到最大连接数时的行为
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";

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
    "test_mongodb_pool",
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
      maxPoolSize: 2, // 设置较小的最大连接数以便测试
    },
  };
}

describe("MongoDB 连接池耗尽测试", () => {
  let adapter: MongoDBAdapter;

  beforeAll(async () => {
    adapter = new MongoDBAdapter();
    const config = createMongoConfig();

    try {
      await adapter.connect(config);
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
    await adapter?.close();
  });

  it("应该在连接池耗尽时正确处理并发请求", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 创建多个并发查询，超过最大连接数
    const promises = Array.from(
      { length: 5 },
      () => adapter.query("test_collection", {}),
    );

    // 所有查询应该都能完成（连接池会排队等待）
    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    results.forEach((result) => {
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该正确报告连接池状态", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    const status = await adapter.getPoolStatus();

    expect(status).toBeTruthy();
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.active).toBeGreaterThanOrEqual(0);
    expect(status.idle).toBeGreaterThanOrEqual(0);
    expect(status.waiting).toBeGreaterThanOrEqual(0);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
