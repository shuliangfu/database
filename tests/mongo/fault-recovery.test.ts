/**
 * @fileoverview MongoDB 故障恢复集成测试
 * 测试数据库连接断开后的自动恢复能力
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_NAME = "mongo_fault_recovery_fault_recovery_test";

describe("MongoDB 故障恢复集成测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 使用 initDatabase 初始化全局 dbManager（含认证：默认 root/8866231）
    await initDatabase(
      createMongoConfig({ database: "test_fault_recovery" }),
    );

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();
  });

  afterAll(async () => {
    // 清理测试数据
    if (adapter) {
      try {
        const db = (adapter as MongoDBAdapter).getDatabase();
        if (db) {
          await db.collection(COLLECTION_NAME).deleteMany({});
        }
      } catch {
        // 忽略错误
      }
    }
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
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
    await adapter.connect(
      createMongoConfig({ database: "test_fault_recovery" }),
    );

    expect(adapter.isConnected()).toBe(true);

    // 验证可以正常查询
    const results = await adapter.query("find", {
      collection: COLLECTION_NAME,
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
      collection: COLLECTION_NAME,
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
          await mongoDb.collection(COLLECTION_NAME).insertOne({
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
      collection: COLLECTION_NAME,
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
      collection: COLLECTION_NAME,
      filter: {},
      options: { limit: 1 },
    });
    expect(results).toBeTruthy();
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
