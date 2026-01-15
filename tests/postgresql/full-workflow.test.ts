/**
 * @fileoverview PostgreSQL 完整工作流程集成测试
 * 测试从数据库连接到 CRUD 操作的完整流程
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@dreamer/test";
import { getDatabase, initDatabase } from "../../src/access.ts";
import { closeDatabase } from "../../src/init-database.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_NAME = "postgresql_full_workflow_integration_users";

/**
 * 测试用户模型
 */
class User extends SQLModel {
  static override tableName = TABLE_NAME;
  static override primaryKey = "id";
}

describe("PostgreSQL 完整工作流程集成测试", () => {
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

    // 初始化数据库
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

    adapter = getDatabase()!;

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME} RESTART IDENTITY`, []);

    // 设置模型适配器
    User.setAdapter(adapter);
  });

  afterAll(async () => {
    await closeDatabase();
    // 等待连接完全释放，特别是在 Bun 测试环境中

  });

  // 每个测试后强制等待连接释放，防止连接泄漏
  afterEach(async () => {
    try {
      // 等待连接池释放空闲连接

      if (adapter && adapter.isConnected()) {
        const status = await adapter.getPoolStatus();
        // 如果活跃连接过多，等待更长时间
        if (status.active > 2) {

        }
      }
    } catch {
      // 忽略错误
    }
  });

  it("应该完成完整的 CRUD 工作流程", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 1. 创建（Create）
    const user1 = await User.create({
      name: "Integration User 1",
      email: "integration1@test.com",
      age: 25,
    });

    expect(user1).toBeTruthy();
    expect(user1.id).toBeTruthy();
    expect(user1.name).toBe("Integration User 1");

    // 2. 读取（Read）
    const foundUser = await User.find(user1.id);
    expect(foundUser).toBeTruthy();
    expect(foundUser?.name).toBe("Integration User 1");

    // 3. 更新（Update）
    await User.update(user1.id, {
      name: "Updated Integration User 1",
      age: 26,
    });

    const updatedUser = await User.find(user1.id);
    expect(updatedUser?.name).toBe("Updated Integration User 1");
    expect(updatedUser?.age).toBe(26);

    // 4. 查询列表
    const users = await User.findAll();
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u) => u.id === user1.id)).toBe(true);

    // 5. 删除（Delete）
    await User.delete(user1.id);

    const deletedUser = await User.find(user1.id);
    expect(deletedUser).toBeNull();
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该支持事务中的完整工作流程", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    await adapter.transaction(async (db) => {
      // 在事务中创建用户
      const user = await User.create({
        name: "Transaction User",
        email: "transaction@test.com",
        age: 30,
      });

      expect(user).toBeTruthy();

      // 在事务中更新用户
      await User.update(user.id, {
        name: "Updated Transaction User",
      });

      // 在事务中查询用户
      const foundUser = await User.find(user.id);
      expect(foundUser?.name).toBe("Updated Transaction User");

      // 在事务中删除用户
      await User.delete(user.id);

      // 验证删除
      const deletedUser = await User.find(user.id);
      expect(deletedUser).toBeNull();
    });
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

  it("应该支持批量操作工作流程", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 批量创建
    const users = await Promise.all([
      User.create({ name: "Batch User 1", email: "batch1@test.com", age: 20 }),
      User.create({ name: "Batch User 2", email: "batch2@test.com", age: 21 }),
      User.create({ name: "Batch User 3", email: "batch3@test.com", age: 22 }),
    ]);

    expect(users.length).toBe(3);

    // 批量查询
    const allUsers = await User.findAll({
      email: { $in: ["batch1@test.com", "batch2@test.com", "batch3@test.com"] },
    });
    expect(allUsers.length).toBe(3);

    // 批量更新
    await User.updateMany(
      { email: { $in: ["batch1@test.com", "batch2@test.com"] } },
      { status: "inactive" },
    );

    const updatedUsers = await User.findAll({
      email: { $in: ["batch1@test.com", "batch2@test.com"] },
    });
    expect(updatedUsers.every((u) => u.status === "inactive")).toBe(true);

    // 批量删除
    await User.deleteMany({
      email: { $in: ["batch1@test.com", "batch2@test.com", "batch3@test.com"] },
    });

    const remainingUsers = await User.findAll({
      email: { $in: ["batch1@test.com", "batch2@test.com", "batch3@test.com"] },
    });
    expect(remainingUsers.length).toBe(0);
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
