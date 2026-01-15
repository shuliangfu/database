/**
 * @fileoverview SQLModel 高级功能测试
 * 测试虚拟字段（virtuals）和查询作用域（scopes）
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
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
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 测试用户模型（带虚拟字段）
 */
class UserWithVirtuals extends SQLModel {
  static override tableName = "postgresql_users_virtuals";
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
  static override tableName = "postgresql_users_scopes";
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
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
      // 等待之前的连接完全释放

    } catch {
      // 忽略清理错误
    }

    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      type: "postgresql",
      connection: {
        host: pgHost,
        port: pgPort,
        database: pgDatabase,
        username: pgUser,
        password: pgPassword,
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS users_virtuals (
        id SERIAL PRIMARY KEY,
        "firstName" VARCHAR(100),
        "lastName" VARCHAR(100),
        age INTEGER,
        nickname VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
    );

    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS users_scopes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        age INTEGER,
        status VARCHAR(50) DEFAULT 'active',
        published BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute("TRUNCATE TABLE users_virtuals RESTART IDENTITY", []);
    await adapter.execute("TRUNCATE TABLE users_scopes RESTART IDENTITY", []);

    // 设置模型适配器
    UserWithVirtuals.setAdapter(adapter);
    UserWithScopes.setAdapter(adapter);
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
      // 等待连接完全释放，特别是在 Bun 测试环境中

    } catch {
      // 忽略关闭错误
    }
  });

  // 每个测试后强制等待连接释放，防止连接泄漏
  afterEach(async () => {
    if (adapter && adapter.isConnected()) {
      try {
        // 获取连接池状态并检查（已移除延时以提升测试速度）
        const status = await adapter.getPoolStatus();
        // 如果活跃连接过多，记录警告但不等待
        if (status.active > 2) {
          console.warn(`警告：连接池中有 ${status.active} 个活跃连接`);
        }
      } catch {
        // 忽略错误
      }
    }
  });

  beforeEach(async () => {
    // 清空测试数据
    await adapter.execute("TRUNCATE TABLE users_virtuals RESTART IDENTITY", []);
    await adapter.execute("TRUNCATE TABLE users_scopes RESTART IDENTITY", []);
  });

  describe("虚拟字段（virtuals）", () => {
    it("应该在查询结果中应用虚拟字段", async () => {
      // 插入测试数据
      await UserWithVirtuals.create({
        firstName: "John",
        lastName: "Doe",
        age: 25,
        nickname: "Johnny",
      });

      // 查询数据
      const user = await UserWithVirtuals.find(1);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("John Doe");
        expect(user.isAdult).toBe(true);
        expect(user.displayName).toBe("Johnny");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持多个虚拟字段", async () => {
      await UserWithVirtuals.create({
        firstName: "Jane",
        lastName: "Smith",
        age: 16,
      });

      const user = await UserWithVirtuals.find(1);

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

    it("应该在 findById 中应用虚拟字段", async () => {
      await UserWithVirtuals.create({
        firstName: "Charlie",
        lastName: "Brown",
        age: 20,
      });

      const user = await UserWithVirtuals.findById(1);

      expect(user).toBeTruthy();
      if (user) {
        expect(user.fullName).toBe("Charlie Brown");
        expect(user.isAdult).toBe(true);
      }
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

    it("应该支持作用域与 where 条件组合", async () => {
      await UserWithScopes.create({
        name: "User 1",
        age: 20,
        status: "active",
      });

      await UserWithScopes.create({
        name: "User 2",
        age: 25,
        status: "active",
      });

      // 手动应用作用域条件
      const activeCondition = UserWithScopes.scopes?.active();
      if (activeCondition) {
        const combinedCondition = {
          ...activeCondition,
          age: { $gte: 22 },
        };
        const users = await UserWithScopes.findAll(combinedCondition);

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("User 2");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
