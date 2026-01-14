/**
 * @fileoverview MongoDB 故障恢复集成测试
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
    "test_fault_recovery",
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

describe("MongoDB 故障恢复集成测试", () => {
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
          await db.collection("fault_recovery_test").deleteMany({});
        }
        await adapter.close();
      } catch {
        // 忽略错误
      }
    }
  });

  it("应该在连接关闭后能够重新连接", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 关闭连接
    await adapter.close();
    expect(adapter.isConnected()).toBe(false);

    // 重新连接
    const config = createMongoConfig();
    await adapter.connect(config);

    expect(adapter.isConnected()).toBe(true);

    // 验证可以正常查询
    const results = await adapter.query("find", {
      collection: "fault_recovery_test",
      filter: {},
      options: { limit: 1 },
    });
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在查询失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 执行一个会失败的查询（使用无效的集合名）
    try {
      await adapter.query("find", {
        collection: "nonexistent_collection_12345",
        filter: { invalidField: { $invalidOperator: "value" } },
        options: {},
      });
    } catch (error) {
      // 预期会失败
      expect(error).toBeInstanceOf(Error);
    }

    // 验证连接仍然正常
    expect(adapter.isConnected()).toBe(true);

    // 验证可以继续执行正常查询
    const results = await adapter.query("find", {
      collection: "fault_recovery_test",
      filter: {},
      options: { limit: 1 },
    });
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在事务失败后能够继续工作", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 执行一个会失败的事务
    try {
      await adapter.transaction(async (db) => {
        const mongoDb = (db as MongoDBAdapter).getDatabase();
        if (mongoDb) {
          await mongoDb.collection("fault_recovery_test").insertOne({
            name: "Test",
            value: 1,
          });
        }
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
    const results = await adapter.query("find", {
      collection: "fault_recovery_test",
      filter: {},
      options: { limit: 1 },
    });
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该在多次错误后连接池仍然正常", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 执行多次会失败的操作
    for (let i = 0; i < 5; i++) {
      try {
        await adapter.query("find", {
          collection: "nonexistent_collection_12345",
          filter: { invalidField: { $invalidOperator: "value" } },
          options: {},
        });
      } catch {
        // 忽略错误
      }
    }

    // 检查连接池状态
    const status = await adapter.getPoolStatus();
    expect(status).toBeTruthy();
    expect(status.total).toBeGreaterThanOrEqual(0);

    // 验证可以继续执行正常查询
    const results = await adapter.query("find", {
      collection: "fault_recovery_test",
      filter: {},
      options: { limit: 1 },
    });
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
