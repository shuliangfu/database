/**
 * @fileoverview MongoModel 高级功能测试
 * 测试虚拟字段（virtuals）和查询作用域（scopes）
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
import { MongoModel } from "../../src/orm/mongo-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_VIRTUALS = "mongo_model_advanced_users_virtuals";
const COLLECTION_SCOPES = "mongo_model_advanced_users_scopes";
const COLLECTION_SCOPES_SINGLE = "mongo_model_advanced_users_scopes_single";
const COLLECTION_SCOPES_COMBINE = "mongo_model_advanced_users_scopes_combine";
const COLLECTION_SCOPES_COUNT = "mongo_model_advanced_users_scopes_count";

/**
 * 测试用户模型（带虚拟字段）
 */
class UserWithVirtuals extends MongoModel {
  static override collectionName = COLLECTION_VIRTUALS;
  static override primaryKey = "_id";

  // 定义虚拟字段
  static override virtuals = {
    fullName: (instance: any) => {
      return `${instance.firstName || ""} ${instance.lastName || ""}`.trim();
    },
    isAdult: (instance: any) => {
      return instance.age >= 18;
    },
    displayName: (instance: any) => {
      return instance.nickname || instance.fullName || "Anonymous";
    },
  };
}

/**
 * 测试用户模型（带查询作用域）
 */
class UserWithScopes extends MongoModel {
  static override collectionName = COLLECTION_SCOPES;
  static override primaryKey = "_id";

  // 定义查询作用域
  static override scopes = {
    active: () => ({ status: "active" }),
    adult: () => ({ age: { $gte: 18 } }),
    recent: () => ({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    published: () => ({ published: true }),
  };
}

describe("MongoModel 高级功能", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      await initDatabase(
        createMongoConfig({ database: "test_mongodb_advanced" }),
      );

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();

      // 设置模型适配器
      UserWithVirtuals.setAdapter(adapter);
      UserWithScopes.setAdapter(adapter);
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
          await db.collection(COLLECTION_VIRTUALS).drop().catch(
            () => {},
          );
          await db.collection(COLLECTION_SCOPES).drop().catch(
            () => {},
          );
          await db.collection(COLLECTION_SCOPES_SINGLE).drop().catch(
            () => {},
          );
          await db.collection(COLLECTION_SCOPES_COMBINE).drop().catch(
            () => {},
          );
          await db.collection(COLLECTION_SCOPES_COUNT).drop().catch(
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
      await db.collection(COLLECTION_VIRTUALS).deleteMany({});
      await db.collection(COLLECTION_SCOPES).deleteMany({});
    }
  });

  describe("虚拟字段（virtuals）", () => {
    it("应该在查询结果中应用虚拟字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据并查询
      const created = await UserWithVirtuals.create({
        firstName: "John",
        lastName: "Doe",
        age: 25,
        nickname: "Johnny",
      });

      const user = await UserWithVirtuals.findById(created._id);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("John Doe");
        expect(user.isAdult).toBe(true);
        expect(user.displayName).toBe("Johnny");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持多个虚拟字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const created = await UserWithVirtuals.create({
        firstName: "Jane",
        lastName: "Smith",
        age: 16,
      });

      const user = await UserWithVirtuals.findById(created._id);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("Jane Smith");
        expect(user.isAdult).toBe(false);
        expect(user.displayName).toBe("Jane Smith"); // 没有nickname，使用fullName
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在 findAll 中应用虚拟字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await UserWithVirtuals.create({
        firstName: "Alice",
        lastName: "Johnson",
        age: 30,
        nickname: "Ali",
      });

      await UserWithVirtuals.create({
        firstName: "Bob",
        lastName: "Williams",
        age: 17,
      });

      const users = await UserWithVirtuals.findAll();

      expect(users.length).toBe(2);
      expect(users[0].fullName).toBeTruthy();
      expect(users[0].isAdult).toBeTruthy();
      expect(users[1].fullName).toBeTruthy();
      expect(users[1].isAdult).toBe(false);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在 findById 中应用虚拟字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const created = await UserWithVirtuals.create({
        firstName: "Charlie",
        lastName: "Brown",
        age: 20,
      });

      const user = await UserWithVirtuals.findById(created._id);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("Charlie Brown");
        expect(user.isAdult).toBe(true);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理空值的虚拟字段", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const created = await UserWithVirtuals.create({
        firstName: null,
        lastName: null,
        age: null,
      });

      const user = await UserWithVirtuals.findById(created._id);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe(""); // 空字符串
        expect(user.isAdult).toBe(false); // null >= 18 为 false
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询作用域（scopes）", () => {
    it("应该支持单个作用域", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 使用独立的集合，避免并发测试时的数据污染
      class UserWithScopesSingle extends MongoModel {
        static override collectionName = COLLECTION_SCOPES_SINGLE;
        static override primaryKey = "_id";
        static override scopes = {
          active: () => ({ status: "active" }),
        };
      }
      UserWithScopesSingle.setAdapter(adapter);

      // 清理独立集合
      const db = adapter.getDatabase();
      if (db) {
        await db.collection(COLLECTION_SCOPES_SINGLE).deleteMany({});
      }

      await UserWithScopesSingle.create({
        name: "Active User",
        age: 25,
        status: "active",
      });

      await UserWithScopesSingle.create({
        name: "Inactive User",
        age: 30,
        status: "inactive",
      });

      // 使用作用域查询
      // 明确传递 includeTrashed 和 onlyTrashed 参数，确保查询行为一致
      const activeUsers = await UserWithScopesSingle.scope("active").findAll(
        {},
        undefined,
        undefined,
        false,
        false,
      );

      expect(activeUsers.length).toBe(1);
      expect(activeUsers[0].name).toBe("Active User");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持作用域与条件组合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 使用独立的集合，避免并发测试时的数据污染
      class UserWithScopesCombine extends MongoModel {
        static override collectionName = COLLECTION_SCOPES_COMBINE;
        static override primaryKey = "_id";
        static override scopes = {
          active: () => ({ status: "active" }),
        };
      }
      UserWithScopesCombine.setAdapter(adapter);

      // 清理独立集合
      const db = adapter.getDatabase();
      if (db) {
        // 清除缓存
        if (UserWithScopesCombine.cacheAdapter) {
          UserWithScopesCombine.cacheAdapter.clear();
        }
        // 删除所有数据
        await db.collection(COLLECTION_SCOPES_COMBINE).deleteMany({});
        // 验证数据已被清理
        const countBefore = await db.collection(COLLECTION_SCOPES_COMBINE)
          .countDocuments({});
        if (countBefore > 0) {
          // 如果还有数据，再次清理
          await db.collection(COLLECTION_SCOPES_COMBINE).deleteMany({});
        }
      }

      await UserWithScopesCombine.deleteMany({});

      await UserWithScopesCombine.create({
        name: "Adult Active User 1",
        age: 25,
        status: "active",
      });

      await UserWithScopesCombine.create({
        name: "Child Active User 2",
        age: 15,
        status: "active",
      });

      await UserWithScopesCombine.create({
        name: "Adult Inactive User 3",
        age: 30,
        status: "inactive",
      });

      // 清除缓存，确保不会使用之前测试的缓存数据
      if (UserWithScopesCombine.cacheAdapter) {
        UserWithScopesCombine.cacheAdapter.clear();
      }

      // 使用作用域并添加额外条件（模拟多个作用域的效果）
      // 明确传递 includeTrashed 和 onlyTrashed 参数，确保查询行为一致
      const activeUsers = await UserWithScopesCombine.scope("active").findAll(
        { age: { $gte: 18 } },
        undefined,
        undefined,
        false,
        false,
      );

      expect(activeUsers.length).toBe(1);
      expect(activeUsers[0].name).toBe("Adult Active User 1");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持作用域与 count 组合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 使用独立的集合，避免并发测试时的数据污染
      class UserWithScopesCount extends MongoModel {
        static override collectionName = COLLECTION_SCOPES_COUNT;
        static override primaryKey = "_id";
        static override scopes = {
          published: () => ({ published: true }),
        };
      }
      UserWithScopesCount.setAdapter(adapter);

      // 清理独立集合
      const db = adapter.getDatabase();
      if (db) {
        await db.collection(COLLECTION_SCOPES_COUNT).deleteMany({});
      }

      await UserWithScopesCount.create({
        name: "Published User",
        age: 25,
        published: true,
      });

      await UserWithScopesCount.create({
        name: "Unpublished User",
        age: 30,
        published: false,
      });

      const count = await UserWithScopesCount.scope("published").count();

      expect(count).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
