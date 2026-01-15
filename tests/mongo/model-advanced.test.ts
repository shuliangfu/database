/**
 * @fileoverview MongoModel 高级功能测试
 * 测试虚拟字段（virtuals）和查询作用域（scopes）
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
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MongoModel } from "../../src/orm/mongo-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_VIRTUALS = "mongo_model_advanced_users_virtuals";
const COLLECTION_SCOPES = "mongo_model_advanced_users_scopes";

/**
 * 创建 MongoDB 配置
 */
function createMongoConfig() {
  const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
  const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
  const mongoDatabase = getEnvWithDefault(
    "MONGODB_DATABASE",
    "test_mongodb_advanced",
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
    const config = createMongoConfig();

    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase(config);

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

      await UserWithScopes.create({
        name: "Active User",
        age: 25,
        status: "active",
      });

      await UserWithScopes.create({
        name: "Inactive User",
        age: 30,
        status: "inactive",
      });

      // 使用作用域查询
      const activeUsers = await UserWithScopes.scope("active").findAll();

      expect(activeUsers.length).toBe(1);
      expect(activeUsers[0].name).toBe("Active User");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持作用域与条件组合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 确保测试开始时数据是干净的（防止其他测试的数据污染）
      const db = (adapter as any).getDatabase();
      if (db) {
        await db.collection(COLLECTION_SCOPES).deleteMany({});
      }

      await UserWithScopes.create({
        name: "Adult Active User",
        age: 25,
        status: "active",
      });

      await UserWithScopes.create({
        name: "Child Active User",
        age: 15,
        status: "active",
      });

      await UserWithScopes.create({
        name: "Adult Inactive User",
        age: 30,
        status: "inactive",
      });

      // 使用作用域并添加额外条件（模拟多个作用域的效果）
      const activeUsers = await UserWithScopes.scope("active").findAll({
        age: { $gte: 18 },
      });

      expect(activeUsers.length).toBe(1);
      expect(activeUsers[0].name).toBe("Adult Active User");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持作用域与 count 组合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await UserWithScopes.create({
        name: "Published User",
        age: 25,
        published: true,
      });

      await UserWithScopes.create({
        name: "Unpublished User",
        age: 30,
        published: false,
      });

      const count = await UserWithScopes.scope("published").count();

      expect(count).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
