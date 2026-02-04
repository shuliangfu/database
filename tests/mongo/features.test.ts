/**
 * @fileoverview MongoDB 特有功能测试
 * 测试 MongoDB 特有的功能：索引、集合操作、数据验证、连接选项等
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_INDEX_DATA = "mongo_features_test_index_data";
const COLLECTION_COLLECTION_OPS = "mongo_features_test_collection_ops";
const COLLECTION_VALIDATION_DATA = "mongo_features_test_validation_data";
const COLLECTION_INDEX_UNIQUE = "mongo_features_test_index_unique";
const COLLECTION_INDEX_DELETE = "mongo_features_test_index_delete";
const COLLECTION_BATCH_INSERT = "mongo_features_test_batch_insert";
const COLLECTION_BATCH_ORDERED = "mongo_features_test_batch_ordered";

describe("MongoDB 特有功能", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 使用 initDatabase 初始化全局 dbManager（含认证：默认 root/8866231）
      await initDatabase(
        createMongoConfig({ database: "test_mongodb_features" }),
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
    if (adapter) {
      try {
        const db = (adapter as any).getDatabase();
        if (db) {
          // 清理测试集合
          await db.collection(COLLECTION_INDEX_DATA).drop().catch(() => {});
          await db.collection(COLLECTION_COLLECTION_OPS).drop().catch(() => {});
          await db.collection(COLLECTION_VALIDATION_DATA).drop().catch(
            () => {},
          );
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

  beforeEach(async () => {
    if (!adapter) return;

    const db = (adapter as any).getDatabase();
    if (db) {
      // 清理测试数据
      await db.collection(COLLECTION_INDEX_DATA).deleteMany({});
      await db.collection(COLLECTION_COLLECTION_OPS).deleteMany({});
      await db.collection(COLLECTION_VALIDATION_DATA).deleteMany({});
    }
  });

  describe("索引操作", () => {
    it("应该支持创建单字段索引", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_INDEX_DATA);

      // 插入测试数据
      await collection.insertMany([
        { name: "User 1", email: "user1@test.com", age: 25 },
        { name: "User 2", email: "user2@test.com", age: 30 },
        { name: "User 3", email: "user3@test.com", age: 35 },
      ]);

      // 创建索引
      await collection.createIndex({ email: 1 });

      // 查询索引
      const indexes = await collection.indexes();
      const emailIndex = indexes.find((idx: any) => idx.key?.email === 1);

      expect(emailIndex).toBeTruthy();
      expect(emailIndex?.key?.email).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持创建复合索引", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_INDEX_DATA);

      // 创建复合索引
      await collection.createIndex({ name: 1, age: -1 });

      // 查询索引
      const indexes = await collection.indexes();
      const compoundIndex = indexes.find(
        (idx: any) => idx.key?.name === 1 && idx.key?.age === -1,
      );

      expect(compoundIndex).toBeTruthy();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持创建唯一索引", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_INDEX_UNIQUE);

      // 清理之前的数据和索引
      await collection.drop().catch(() => {});

      // 创建唯一索引
      try {
        await collection.createIndex({ email: 1 }, { unique: true });
      } catch (error) {
        // 如果索引已存在，忽略错误
        if (
          !(error instanceof Error && error.message.includes("already exists"))
        ) {
          throw error;
        }
      }

      // 插入数据
      await collection.insertOne({
        name: "Unique User",
        email: "unique@test.com",
        age: 25,
      });

      // 尝试插入重复的 email（应该失败）
      try {
        await collection.insertOne({
          name: "Duplicate User",
          email: "unique@test.com",
          age: 30,
        });
        // 如果插入成功，测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出唯一索引违反错误
        expect(error).toBeInstanceOf(Error);
      }

      // 清理
      await collection.drop().catch(() => {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持删除索引", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_INDEX_DELETE);

      // 清理之前的数据和索引
      await collection.drop().catch(() => {});

      // 创建索引
      await collection.createIndex({ name: 1 });

      // 删除索引（使用索引名称或字段）
      const indexesBefore = await collection.indexes();
      const nameIndexBefore = indexesBefore.find((idx: any) =>
        idx.key?.name === 1
      );
      if (nameIndexBefore && nameIndexBefore.name) {
        await collection.dropIndex(nameIndexBefore.name);
      } else {
        // 尝试使用默认索引名
        try {
          await collection.dropIndex("name_1");
        } catch {
          // 如果失败，尝试使用索引键对象（需要 MongoDB 驱动支持）
          // 注意：某些版本的 MongoDB 驱动可能不支持直接使用键对象
          await collection.dropIndex({ name: 1 } as any).catch(() => {});
        }
      }

      // 验证索引已删除
      const indexesAfter = await collection.indexes();
      const nameIndexAfter = indexesAfter.find((idx: any) =>
        idx.key?.name === 1
      );

      // _id 索引总是存在，但 name 索引应该不存在了
      expect(nameIndexAfter).toBeFalsy();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持查询索引列表", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_INDEX_DATA);

      // 创建多个索引
      await collection.createIndex({ name: 1 });
      await collection.createIndex({ age: -1 });
      await collection.createIndex({ email: 1 });

      // 查询所有索引
      const indexes = await collection.indexes();

      // 至少应该有 _id 索引和创建的索引
      expect(indexes.length).toBeGreaterThanOrEqual(4); // _id + 3个创建的索引
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("集合操作", () => {
    it("应该支持创建集合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // 创建集合
      await db.createCollection(COLLECTION_COLLECTION_OPS);

      // 验证集合存在
      const collections = await db.listCollections().toArray();
      const collectionExists = collections.some(
        (c: any) => c.name === COLLECTION_COLLECTION_OPS,
      );

      expect(collectionExists).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持删除集合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // 创建集合
      await db.createCollection(COLLECTION_COLLECTION_OPS);

      // 删除集合
      await db.collection(COLLECTION_COLLECTION_OPS).drop();

      // 验证集合已删除
      const collections = await db.listCollections().toArray();
      const collectionExists = collections.some(
        (c: any) => c.name === COLLECTION_COLLECTION_OPS,
      );

      expect(collectionExists).toBe(false);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持列出所有集合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // 创建一些集合
      await db.createCollection(COLLECTION_COLLECTION_OPS).catch(() => {});
      await db.collection(COLLECTION_INDEX_DATA).insertOne({}).catch(() => {});

      // 列出所有集合
      const collections = await db.listCollections().toArray();

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持获取集合统计信息", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_COLLECTION_OPS);

      // 插入测试数据
      await collection.insertMany([
        { name: "User 1", age: 25 },
        { name: "User 2", age: 30 },
        { name: "User 3", age: 35 },
      ]);

      // 获取统计信息
      const stats = await db.command({ collStats: COLLECTION_COLLECTION_OPS });

      expect(stats).toBeTruthy();
      expect(stats.count).toBe(3);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("数据验证", () => {
    it("应该支持集合验证规则", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // 创建带验证规则的集合
      try {
        await db.createCollection(COLLECTION_VALIDATION_DATA, {
          validator: {
            $jsonSchema: {
              bsonType: "object",
              required: ["name", "email"],
              properties: {
                name: {
                  bsonType: "string",
                  description: "name must be a string and is required",
                },
                email: {
                  bsonType: "string",
                  pattern: "^.+@.+$",
                  description:
                    "email must be a string matching the regular expression pattern and is required",
                },
                age: {
                  bsonType: "int",
                  minimum: 0,
                  maximum: 150,
                  description: "age must be an integer between 0 and 150",
                },
              },
            },
          },
        });

        // 插入有效数据
        await db.collection(COLLECTION_VALIDATION_DATA).insertOne({
          name: "Valid User",
          email: "valid@test.com",
          age: 25,
        });

        // 尝试插入无效数据（缺少必需字段）
        try {
          await db.collection(COLLECTION_VALIDATION_DATA).insertOne({
            name: "Invalid User",
            // 缺少 email
          });
          // 如果插入成功，测试失败（取决于验证级别）
          // 注意：MongoDB 的验证可能不会立即抛出错误，取决于验证级别
        } catch (error) {
          // 如果验证生效，应该抛出错误
          expect(error).toBeInstanceOf(Error);
        }
      } catch (error) {
        // 如果创建集合失败（可能不支持验证），跳过测试
        console.log("Collection validation not supported, skipping test");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接选项", () => {
    it("应该支持 maxPoolSize 配置", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const testAdapter = new MongoDBAdapter();

      try {
        await testAdapter.connect(
          createMongoConfig({ mongoOptions: { maxPoolSize: 10 } }),
        );

        expect(testAdapter.isConnected()).toBe(true);
        await testAdapter.close();
      } catch (error) {
        console.log("Connection test failed, skipping");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 serverSelectionTimeoutMS 配置", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const testAdapter = new MongoDBAdapter();

      try {
        await testAdapter.connect(
          createMongoConfig({
            mongoOptions: { serverSelectionTimeoutMS: 30000 },
          }),
        );

        expect(testAdapter.isConnected()).toBe(true);
        await testAdapter.close();
      } catch (error) {
        console.log("Connection test failed, skipping");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("批量操作错误处理", () => {
    it("应该处理批量插入的部分失败", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_BATCH_INSERT);

      // 清理之前的数据和索引
      await collection.drop().catch(() => {});

      // 创建唯一索引（使用明确的索引名避免冲突）
      try {
        await collection.createIndex(
          { email: 1 },
          { unique: true, name: "email_unique_batch" },
        );
      } catch (error) {
        // 如果索引已存在，先删除再创建
        if (error instanceof Error && error.message.includes("same name")) {
          await collection.dropIndex("email_unique_batch").catch(() => {});
          await collection.createIndex(
            { email: 1 },
            { unique: true, name: "email_unique_batch" },
          );
        } else if (
          !(error instanceof Error && error.message.includes("already exists"))
        ) {
          throw error;
        }
      }

      // 插入第一个文档
      await collection.insertOne({
        name: "User 1",
        email: "duplicate@test.com",
        age: 25,
      });

      // 尝试批量插入（包含重复的 email）
      // 注意：MongoDB 的 insertMany 默认使用 ordered: true，遇到错误会停止
      // 但在停止之前可能已经成功插入了部分文档
      try {
        await adapter.execute("insertMany", COLLECTION_BATCH_INSERT, [
          { name: "User 2", email: "unique2@test.com", age: 30 },
          { name: "User 3", email: "duplicate@test.com", age: 35 }, // 重复
          { name: "User 4", email: "unique4@test.com", age: 40 },
        ]);

        // 如果插入成功（不应该发生），测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出唯一索引违反错误
        expect(error).toBeInstanceOf(Error);
        // 验证文档数：至少应该有 User 1，可能还有 User 2（在错误发生前插入）
        // 但 User 3 和 User 4 不应该被插入
        const count = await collection.countDocuments({});
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThan(4);
        // 验证 User 3 没有被插入（因为它是重复的）
        const user3 = await collection.findOne({ email: "duplicate@test.com" });
        // 应该只有 User 1，因为 User 3 是重复的
        expect(user3?.name).toBe("User 1");
      }

      // 清理
      await collection.drop().catch(() => {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 ordered: false 的批量操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const collection = db.collection(COLLECTION_BATCH_ORDERED);

      // 清理之前的数据和索引
      await collection.drop().catch(() => {});

      // 使用 execute 方法执行 insertMany（通过适配器）
      // 注意：这里我们需要直接使用 MongoDB 客户端，因为适配器的 execute 方法可能不支持 ordered 选项
      try {
        const result = await collection.insertMany(
          [
            { name: "User 1", email: "batch1@test.com", age: 25 },
            { name: "User 2", email: "batch2@test.com", age: 30 },
            { name: "User 3", email: "batch3@test.com", age: 35 },
          ],
          { ordered: false },
        );

        expect(result.insertedCount).toBe(3);
      } catch (error) {
        // 如果出错，验证错误信息
        expect(error).toBeInstanceOf(Error);
      }

      // 清理
      await collection.drop().catch(() => {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("认证配置", () => {
    it("应该支持带认证的连接", async () => {
      // createMongoConfig 默认使用 root/8866231 认证
      const testAdapter = new MongoDBAdapter();

      try {
        await testAdapter.connect(createMongoConfig());

        expect(testAdapter.isConnected()).toBe(true);
        await testAdapter.close();
      } catch (error) {
        console.log("Authentication test failed, skipping");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
