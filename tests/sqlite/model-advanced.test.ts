/**
 * @fileoverview SQLModel 高级功能测试
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
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 测试用户模型（带虚拟字段）
 */
class UserWithVirtuals extends SQLModel {
  static override tableName = "sqlite_users_virtuals";
  static override primaryKey = "id";

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
class UserWithScopes extends SQLModel {
  static override tableName = "sqlite_users_scopes";
  static override primaryKey = "id";

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

describe("SQLModel 高级功能", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS users_virtuals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT,
        lastName TEXT,
        age INTEGER,
        nickname TEXT,
        status TEXT DEFAULT 'active',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
    );

    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS users_scopes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        age INTEGER,
        status TEXT DEFAULT 'active',
        published INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
    );

    // 设置模型适配器
    UserWithVirtuals.setAdapter(adapter);
    UserWithScopes.setAdapter(adapter);
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  beforeEach(async () => {
    // 清空测试数据
    await adapter.execute("DELETE FROM sqlite_users_virtuals", []);
    await adapter.execute("DELETE FROM sqlite_users_scopes", []);
  });

  describe("虚拟字段（virtuals）", () => {
    it("应该在查询结果中应用虚拟字段", async () => {
      await UserWithVirtuals.create({
        firstName: "John",
        lastName: "Doe",
        age: 25,
        nickname: "Johnny",
      });

      const user = await UserWithVirtuals.find(1);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("John Doe");
        expect(user.isAdult).toBe(true);
        expect(user.displayName).toBe("Johnny");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持多个虚拟字段", async () => {
      const created = await UserWithVirtuals.create({
        firstName: "Jane",
        lastName: "Smith",
        age: 16,
      });

      const user = await UserWithVirtuals.find(created.id);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("Jane Smith");
        expect(user.isAdult).toBe(false);
        expect(user.displayName).toBe("Jane Smith");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在 findAll 中应用虚拟字段", async () => {
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
  });

  describe("查询作用域（scopes）", () => {
    it("应该支持单个作用域", async () => {
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

      // 手动应用作用域条件
      const activeCondition = UserWithScopes.scopes?.active();
      if (activeCondition) {
        const activeUsers = await UserWithScopes.findAll(activeCondition);

        expect(activeUsers.length).toBe(1);
        expect(activeUsers[0].name).toBe("Active User");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持多个作用域链式调用", async () => {
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

      // 合并多个作用域条件
      const activeCondition = UserWithScopes.scopes?.active();
      const adultCondition = UserWithScopes.scopes?.adult();
      if (activeCondition && adultCondition) {
        const combinedCondition = {
          ...activeCondition,
          ...adultCondition,
        };
        const users = await UserWithScopes.findAll(combinedCondition);

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Adult Active User");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
