/**
 * @fileoverview MongoDB 完整工作流程集成测试
 * 测试从数据库连接到 CRUD 操作的完整流程
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
import { getDatabase, initDatabase } from "../../src/access.ts";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import { closeDatabase } from "../../src/init-database.ts";
import { MongoModel } from "../../src/orm/mongo-model.ts";
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
    "test_integration",
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
 * 测试用户模型
 */
class User extends MongoModel {
  static override collectionName = "integration_users";
  static override primaryKey = "_id";
}

describe("MongoDB 完整工作流程集成测试", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    const config = createMongoConfig();

    // 初始化数据库
    await initDatabase(config);

    adapter = getDatabase()!;

    // 设置模型适配器
    User.setAdapter(adapter);
  });

  afterAll(async () => {
    // 清理测试数据
    if (adapter) {
      try {
        const db = (adapter as MongoDBAdapter).getDatabase();
        if (db) {
          await db.collection("integration_users").deleteMany({});
        }
      } catch {
        // 忽略错误
      }
    }
    await closeDatabase();
  });

  beforeEach(async () => {
    // 每个测试前清理数据
    if (adapter) {
      try {
        const db = (adapter as MongoDBAdapter).getDatabase();
        if (db) {
          await db.collection("integration_users").deleteMany({});
        }
      } catch {
        // 忽略错误
      }
    }
  });

  it("应该完成完整的 CRUD 工作流程", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
      return;
    }

    // 1. 创建（Create）
    const user1 = await User.create({
      name: "Integration User 1",
      email: "integration1@test.com",
      age: 25,
    });

    expect(user1).toBeTruthy();
    expect(user1._id).toBeTruthy();
    expect(user1.name).toBe("Integration User 1");

    // 2. 读取（Read）
    const foundUser = await User.find(user1._id);
    expect(foundUser).toBeTruthy();
    expect(foundUser?.name).toBe("Integration User 1");

    // 3. 更新（Update）
    await User.update(user1._id, {
      name: "Updated Integration User 1",
      age: 26,
    });

    const updatedUser = await User.find(user1._id);
    expect(updatedUser?.name).toBe("Updated Integration User 1");
    expect(updatedUser?.age).toBe(26);

    // 4. 查询列表
    const users = await User.findAll();
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u) => u._id?.toString() === user1._id?.toString())).toBe(
      true,
    );

    // 5. 删除（Delete）
    await User.delete(user1._id);

    const deletedUser = await User.find(user1._id);
    expect(deletedUser).toBeNull();
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持事务中的完整工作流程", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
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
      await User.update(user._id, {
        name: "Updated Transaction User",
      });

      // 在事务中查询用户
      const foundUser = await User.find(user._id);
      expect(foundUser?.name).toBe("Updated Transaction User");

      // 在事务中删除用户
      await User.delete(user._id);

      // 验证删除
      const deletedUser = await User.find(user._id);
      expect(deletedUser).toBeNull();
    });
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持批量操作工作流程", async () => {
    if (!adapter) {
      console.log("MongoDB not available, skipping test");
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
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
