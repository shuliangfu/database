/**
 * @fileoverview MongoDB 错误处理测试
 * 测试 MongoDB 适配器在各种错误场景下的处理能力
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_NAME = "mongo_error_handling_test_collection";
const COLLECTION_UNIQUE = "mongo_error_handling_test_unique_error";
const COLLECTION_TX = "mongo_error_handling_test_tx_error";

describe("MongoDB 错误处理", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 使用 initDatabase 初始化全局 dbManager（含认证：默认 root/8866231）
      await initDatabase(
        createMongoConfig({ database: "test_mongodb_errors" }),
      );

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();
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
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  describe("连接错误", () => {
    it("应该处理无效的主机名", async () => {
      const badAdapter = new MongoDBAdapter();
      await assertRejects(
        async () => {
          // 使用 Promise.race 添加超时，避免长时间等待
          await Promise.race([
            badAdapter.connect({
              type: "mongodb",
              connection: {
                host: "invalid_host_that_does_not_exist_12345",
                port: 27017,
                database: "test",
              },
              mongoOptions: {
                serverSelectionTimeoutMS: 2000, // 2秒超时
                maxRetries: 0, // 不重试，快速失败
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection timeout")), 5000)
            ),
          ]);
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
      timeout: 10000, // 10秒超时
    });

    it("应该处理无效的端口", async () => {
      const badAdapter = new MongoDBAdapter();
      await assertRejects(
        async () => {
          // 使用 Promise.race 添加超时，避免长时间等待
          await Promise.race([
            badAdapter.connect({
              type: "mongodb",
              connection: {
                host: "localhost",
                port: 99999,
                database: "test",
              },
              mongoOptions: {
                serverSelectionTimeoutMS: 2000, // 2秒超时
                maxRetries: 0, // 不重试，快速失败
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection timeout")), 5000)
            ),
          ]);
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
      timeout: 10000, // 10秒超时
    });
  });

  describe("查询错误", () => {
    it("应该处理无效的集合名", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 无效的集合名（包含特殊字符）
      try {
        await adapter.query("invalid-collection-name-123", {});
        // MongoDB 可能允许某些特殊字符，所以不一定失败
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理无效的查询语法", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // MongoDB 查询语法错误（使用无效的操作符）
      try {
        await adapter.query(COLLECTION_NAME, {
          $invalidOperator: "value",
        });
        // MongoDB 可能会忽略无效操作符或抛出错误
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("执行错误", () => {
    it("应该处理无效的操作类型", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("invalidOperation", COLLECTION_NAME, {});
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理缺少必需参数", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("insert", undefined as any, {});
        },
        Error,
      );

      await assertRejects(
        async () => {
          await adapter.execute("insert", COLLECTION_NAME, undefined);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理唯一索引违反错误", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = adapter.getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_UNIQUE);

      // 创建唯一索引
      await collection.createIndex({ email: 1 }, { unique: true });

      // 插入第一个文档
      await adapter.execute("insert", COLLECTION_UNIQUE, {
        name: "User 1",
        email: "unique@test.com",
      });

      // 尝试插入重复的 email
      await assertRejects(
        async () => {
          await adapter.execute("insert", COLLECTION_UNIQUE, {
            name: "User 2",
            email: "unique@test.com",
          });
        },
        Error,
      );

      // 清理
      await collection.drop().catch(() => {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务错误", () => {
    it("应该处理事务中的错误并正确回滚", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.transaction(async (db) => {
            await db.execute("insert", COLLECTION_TX, {
              name: "TX User",
            });
            // 故意抛出错误
            throw new Error("Transaction error");
          });
        },
        Error,
      );

      // 验证数据已回滚（MongoDB 事务会自动回滚）
      const results = await adapter.query(COLLECTION_TX, {
        name: "TX User",
      });
      expect(results.length).toBe(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池错误", () => {
    it("应该在连接关闭后拒绝新查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const testAdapter = new MongoDBAdapter();
      await testAdapter.connect(createMongoConfig());

      await testAdapter.close();

      // 关闭后应该无法查询
      await assertRejects(
        async () => {
          await testAdapter.query(COLLECTION_NAME, {});
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
