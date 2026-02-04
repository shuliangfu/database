/**
 * @fileoverview MongoQueryBuilder 测试
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoQueryBuilder } from "../../src/query/mongo-builder.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_NAME = "mongo_query_builder_users";

describe("MongoQueryBuilder", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      await initDatabase(
        createMongoConfig({ database: "test_mongo_query_builder" }),
      );

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();
    } catch (error) {
      // MongoDB 不可用，跳过测试
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.warn(
        `MongoDB not available, skipping tests. Error: ${errorMessage}`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    // 清理测试数据
    if (adapter) {
      try {
        const db = (adapter as any).db;
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

  beforeEach(async () => {
    if (!adapter) {
      return;
    }
    // 每个测试前清理数据
    const db = (adapter as any).db;
    if (db) {
      await db.collection(COLLECTION_NAME).deleteMany({});
    }
  });

  describe("from", () => {
    it("应该设置集合名称", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入测试数据
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertOne({
        name: "Alice",
        age: 25,
      });

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).query();

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("find", () => {
    it("应该设置查询过滤器", async () => {
      // 先插入测试数据
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).find({
        name: "Alice",
      })
        .query();

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("eq", () => {
    it("应该添加等于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25, status: "active" },
        { name: "Bob", age: 30, status: "inactive" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).eq("status", "active")
        .query();

      expect(results.length).toBe(1);
      expect(results[0].status).toBe("active");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("gt, gte, lt, lte", () => {
    it("应该添加大于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).gt("age", 20).query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(user.age).toBeGreaterThan(20);
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该添加大于等于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).gte("age", 25)
        .query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(user.age).toBeGreaterThanOrEqual(25);
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该添加小于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).lt("age", 30).query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(user.age).toBeLessThan(30);
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该添加小于等于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).lte("age", 25)
        .query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(user.age).toBeLessThanOrEqual(25);
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("ne", () => {
    it("应该添加不等于条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", status: "active" },
        { name: "Bob", status: "deleted" },
        { name: "Charlie", status: "active" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).ne(
        "status",
        "deleted",
      )
        .query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(user.status).not.toBe("deleted");
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("in", () => {
    it("应该添加 IN 条件", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", status: "active" },
        { name: "Bob", status: "pending" },
        { name: "Charlie", status: "inactive" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).in("status", [
        "active",
        "pending",
      ]).query();

      expect(results.length).toBe(2);
      results.forEach((user) => {
        expect(["active", "pending"]).toContain(user.status);
      });
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("sort", () => {
    it("应该添加排序选项", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).sort({ age: -1 })
        .query();

      expect(results.length).toBe(3);
      expect(results[0].age).toBe(30);
      expect(results[1].age).toBe(25);
      expect(results[2].age).toBe(20);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("limit 和 skip", () => {
    it("应该添加限制数量", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice" },
        { name: "Bob" },
        { name: "Charlie" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).limit(2).query();

      expect(results.length).toBe(2);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该添加偏移量", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 20 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).sort({ age: 1 }).skip(
        1,
      )
        .limit(1).query();

      expect(results.length).toBe(1);
      expect(results[0].age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("query", () => {
    it("应该执行查询并返回结果", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const results = await builder.from(COLLECTION_NAME).query();

      expect(results.length).toBe(2);
      expect(results[0].name).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在集合未设置时抛出错误", async () => {
      const builder = new MongoQueryBuilder(adapter);

      await assertRejects(() => builder.query(), Error);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("queryOne", () => {
    it("应该返回第一条结果", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const result = await builder.from(COLLECTION_NAME).queryOne();

      expect(result).toBeTruthy();
      expect(result?.name).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在无结果时返回 null", async () => {
      const builder = new MongoQueryBuilder(adapter);
      const result = await builder.from(COLLECTION_NAME).queryOne();

      expect(result).toBeNull();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("count", () => {
    it("应该统计记录数量", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice" },
        { name: "Bob" },
        { name: "Charlie" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const count = await builder.from(COLLECTION_NAME).count();

      expect(count).toBe(3);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在集合未设置时抛出错误", async () => {
      const builder = new MongoQueryBuilder(adapter);

      await assertRejects(() => builder.count(), Error);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("execute", () => {
    it("应该返回执行器对象", () => {
      const builder = new MongoQueryBuilder(adapter);
      const executor = builder.from(COLLECTION_NAME).execute();

      expect(executor).toBeTruthy();
      expect(typeof executor.insert).toBe("function");
      expect(typeof executor.update).toBe("function");
      expect(typeof executor.delete).toBe("function");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在集合未设置时抛出错误", () => {
      const builder = new MongoQueryBuilder(adapter);

      expect(() => {
        builder.execute();
      }).toThrow();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("execute().insert", () => {
    it("应该插入单个文档", async () => {
      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .execute()
        .insert({ name: "Alice", age: 25 });

      expect(result).toBeTruthy();
      expect(result.insertedId).toBeTruthy();

      // 验证数据已插入
      const db = (adapter as any).db;
      const users = await db.collection(COLLECTION_NAME).find({ name: "Alice" })
        .toArray();
      expect(users.length).toBe(1);
      expect(users[0].age).toBe(25);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该插入多个文档", async () => {
      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .execute()
        .insertMany([
          { name: "Alice", age: 25 },
          { name: "Bob", age: 30 },
        ]);

      expect(result).toBeTruthy();
      // MongoDB insertMany 返回 { insertedCount, insertedIds }
      // insertedIds 是一个对象（Map），键是索引，值是 ObjectId
      if (result.insertedCount) {
        expect(result.insertedCount).toBe(2);
      } else if (result.insertedIds) {
        // insertedIds 是对象，检查键的数量
        const idsCount = Object.keys(result.insertedIds).length;
        expect(idsCount).toBe(2);
      }

      // 验证数据已插入
      const db = (adapter as any).db;
      const users = await db.collection(COLLECTION_NAME).find({}).toArray();
      expect(users.length).toBe(2);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("execute().update", () => {
    it("应该更新单个文档", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertOne({
        name: "Alice",
        age: 25,
      });

      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .find({ name: "Alice" })
        .execute()
        .update({ age: 26 });

      expect(result).toBeTruthy();
      expect(result.modifiedCount).toBe(1);

      // 验证数据已更新
      const user = await db.collection(COLLECTION_NAME).findOne({
        name: "Alice",
      });
      expect(user?.age).toBe(26);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该更新多个文档", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", age: 25, status: "active" },
        { name: "Bob", age: 30, status: "active" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .find({ status: "active" })
        .execute()
        .updateMany({ status: "inactive" });

      expect(result).toBeTruthy();
      expect(result.modifiedCount).toBe(2);

      // 验证数据已更新
      const users = await db.collection(COLLECTION_NAME).find({
        status: "inactive",
      })
        .toArray();
      expect(users.length).toBe(2);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("execute().delete", () => {
    it("应该删除单个文档", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertOne({
        name: "Alice",
        age: 25,
      });

      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .find({ name: "Alice" })
        .execute()
        .delete();

      expect(result).toBeTruthy();
      expect(result.deletedCount).toBe(1);

      // 验证数据已删除
      const user = await db.collection(COLLECTION_NAME).findOne({
        name: "Alice",
      });
      expect(user).toBeNull();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该删除多个文档", async () => {
      const db = (adapter as any).db;
      await db.collection(COLLECTION_NAME).insertMany([
        { name: "Alice", status: "deleted" },
        { name: "Bob", status: "deleted" },
        { name: "Charlie", status: "active" },
      ]);

      const builder = new MongoQueryBuilder(adapter);
      const result = await builder
        .from(COLLECTION_NAME)
        .find({ status: "deleted" })
        .execute()
        .deleteMany();

      expect(result).toBeTruthy();
      expect(result.deletedCount).toBe(2);

      // 验证数据已删除
      const users = await db.collection(COLLECTION_NAME).find({}).toArray();
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Charlie");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("getFilter 和 getOptions", () => {
    it("应该返回查询过滤器", () => {
      const builder = new MongoQueryBuilder(adapter);
      builder.from(COLLECTION_NAME).find({ name: "Alice" }).eq(
        "status",
        "active",
      );

      const filter = builder.getFilter();
      expect(filter.name).toBe("Alice");
      // eq 方法直接设置值，不是 $eq 操作符
      expect(filter.status).toBe("active");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该返回查询选项", () => {
      const builder = new MongoQueryBuilder(adapter);
      builder.from(COLLECTION_NAME).sort({ age: -1 }).limit(10).skip(5);

      const options = builder.getOptions();
      expect(options.sort).toEqual({ age: -1 });
      expect(options.limit).toBe(10);
      expect(options.skip).toBe(5);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
