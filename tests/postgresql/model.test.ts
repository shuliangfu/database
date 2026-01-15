/**
 * @fileoverview SQLModel 测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
  assertRejects,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { type ModelSchema, SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 测试用户模型
 */
class User extends SQLModel {
  static override tableName = "users";
  static override primaryKey = "id";
}

describe("SQLModel", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
    } catch {
      // 忽略清理错误
    }

    // 获取 PostgreSQL 连接配置
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

    // 创建测试表（包含所有测试需要的字段）
    // 注意：使用 PostgreSQL 语法
    // 先删除表（如果存在），确保表结构正确
    await adapter.execute("DROP TABLE IF EXISTS users CASCADE", []).catch(
      () => {
        // 忽略错误
      },
    );
    await adapter.execute(
      `CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        status VARCHAR(255) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        password VARCHAR(255),
        "confirmPassword" VARCHAR(255),
        "oldPassword" VARCHAR(255),
        "newPassword" VARCHAR(255),
        "startDate" VARCHAR(255),
        "endDate" VARCHAR(255),
        "hasDiscount" INTEGER,
        "discountCode" VARCHAR(255),
        "userType" VARCHAR(255),
        "companyName" VARCHAR(255),
        username VARCHAR(255),
        tags TEXT,
        website VARCHAR(255),
        uuid VARCHAR(255),
        ip VARCHAR(255),
        "birthDate" VARCHAR(255),
        "workTime" VARCHAR(255),
        "categoryId" INTEGER
      )`,
      [],
    );

    // 先删除可能存在的触发器
    await adapter.execute(
      "DROP TRIGGER IF EXISTS update_users_updated_at ON users",
      [],
    ).catch(() => {
      // 忽略错误
    });

    // 创建触发器来自动更新 updated_at（PostgreSQL 不支持 ON UPDATE）
    await adapter.execute(
      `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        -- 检查 updated_at 字段是否存在
        IF TG_TABLE_NAME = 'users' AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'updated_at'
        ) THEN
          NEW.updated_at = CURRENT_TIMESTAMP;
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `,
      [],
    );

    await adapter.execute(
      `
      CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
      [],
    );

    // 清空测试数据并重置序列（PostgreSQL 需要 RESTART IDENTITY）
    await adapter.execute("TRUNCATE TABLE users RESTART IDENTITY", []);

    // 设置模型适配器
    User.setAdapter(adapter);
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

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  describe("init", () => {
    it("应该初始化模型", async () => {
      class TestModel extends SQLModel {
        static override tableName = "test_table";
      }

      // 注意：init 需要真实的数据库连接，这里我们直接设置适配器
      TestModel.setAdapter(adapter);
      expect(TestModel.adapter).toBeTruthy();
    });
  });

  describe("setAdapter", () => {
    it("应该设置数据库适配器", () => {
      class TestModel extends SQLModel {
        static override tableName = "test_table";
      }

      TestModel.setAdapter(adapter);
      expect(TestModel.adapter).toBe(adapter);
    });
  });

  describe("create", () => {
    it("应该创建新记录", async () => {
      const user = await User.create({
        name: "Test User",
        email: "test@example.com",
        age: 25,
      });

      expect(user).toBeTruthy();
      expect(user.id).toBeTruthy();
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
    });

    it("应该支持时间戳自动管理", async () => {
      class TimestampModel extends SQLModel {
        static override tableName = "users";
        static override timestamps = {
          createdAt: "created_at",
          updatedAt: "updated_at",
        };
      }
      TimestampModel.setAdapter(adapter);

      const user = await TimestampModel.create({
        name: "Timestamp User",
        email: "timestamp@example.com",
      });

      // 时间戳字段在数据库中存储为 created_at 和 updated_at
      expect((user as any).created_at).toBeTruthy();
      expect((user as any).updated_at).toBeTruthy();
    });
  });

  describe("find", () => {
    beforeEach(async () => {
      // 清理并插入测试数据
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Alice", email: "alice@test.com", age: 25 });
      await User.create({ name: "Bob", email: "bob@test.com", age: 30 });
    });

    it("应该通过 ID 查找记录", async () => {
      const user = await User.find(1);
      expect(user).toBeTruthy();
      expect(user?.name).toBe("Alice");
    });

    it("应该通过条件对象查找记录", async () => {
      const user = await User.find({ email: "alice@test.com" });
      expect(user).toBeTruthy();
      expect(user?.name).toBe("Alice");
    });

    it("应该支持链式调用查找单条记录", async () => {
      const user = await User.find({ age: { $gt: 20 } })
        .sort({ age: "desc" })
        .findOne();

      expect(user).toBeTruthy();
      expect(user?.age).toBeGreaterThan(20);
    });

    it("应该支持链式调用查找多条记录", async () => {
      const users = await User.find({ age: { $gt: 20 } })
        .sort({ age: "asc" })
        .findAll();

      expect(users.length).toBeGreaterThan(0);
      expect(users[0].age).toBeLessThanOrEqual(users[1]?.age || Infinity);
    });

    it("应该在记录不存在时返回 null", async () => {
      const user = await User.find(999);
      expect(user).toBeNull();
    });

    it("应该支持链式调用 distinct", async () => {
      await User.create({
        name: "Distinct1",
        email: "distinct1@test.com",
        age: 25,
      });
      await User.create({
        name: "Distinct2",
        email: "distinct2@test.com",
        age: 25,
      });
      await User.create({
        name: "Distinct3",
        email: "distinct3@test.com",
        age: 30,
      });

      const ages = await User.find({ age: { $gt: 20 } })
        .distinct("age");
      expect(ages.length).toBeGreaterThan(0);
      expect(ages).toContain(25);
    });

    it("应该支持链式调用 paginate", async () => {
      for (let i = 11; i <= 20; i++) {
        await User.create({
          name: `Page${i}`,
          email: `page${i}@test.com`,
          age: 20 + i,
        });
      }

      const result = await User.find({ age: { $gt: 20 } })
        .sort({ age: "desc" })
        .paginate(1, 5);

      expect(result.data.length).toBe(5);
      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      // 验证排序
      if (result.data.length > 1) {
        expect(result.data[0].age).toBeGreaterThanOrEqual(result.data[1].age);
      }
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "User1", email: "user1@test.com", age: 20 });
      await User.create({ name: "User2", email: "user2@test.com", age: 25 });
      await User.create({ name: "User3", email: "user3@test.com", age: 30 });
    });

    it("应该查找所有记录", async () => {
      const users = await User.findAll();
      expect(users.length).toBeGreaterThanOrEqual(3);
    });

    it("应该支持条件查询", async () => {
      const users = await User.findAll({ age: { $gt: 20 } });
      expect(users.length).toBeGreaterThan(0);
      users.forEach((user) => {
        expect(user.age).toBeGreaterThan(20);
      });
    });

    it("应该支持排序", async () => {
      const users = await User.findAll({}, undefined, {
        sort: { age: "desc" },
      });

      expect(users.length).toBeGreaterThan(0);
      for (let i = 1; i < users.length; i++) {
        expect(users[i - 1].age).toBeGreaterThanOrEqual(users[i].age);
      }
    });

    it("应该支持分页", async () => {
      const users = await User.findAll({}, undefined, {
        limit: 2,
        skip: 0,
      });

      expect(users.length).toBeLessThanOrEqual(2);
    });
  });

  describe("findOne", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({
        name: "FindOne",
        email: "findone@test.com",
        age: 25,
      });
    });

    it("应该查找单条记录", async () => {
      const user = await User.findOne({ email: "findone@test.com" });
      expect(user).toBeTruthy();
      expect(user?.name).toBe("FindOne");
    });

    it("应该在记录不存在时返回 null", async () => {
      const user = await User.findOne({ email: "nonexistent@test.com" });
      expect(user).toBeNull();
    });
  });

  describe("findById", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "ById", email: "byid@test.com", age: 25 });
    });

    it("应该通过 ID 查找记录", async () => {
      const user = await User.findById(1);
      expect(user).toBeTruthy();
      expect(user?.name).toBe("ById");
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Update", email: "update@test.com", age: 25 });
    });

    it("应该更新记录", async () => {
      const affected = await User.update(1, { name: "Updated Name" });
      expect(affected).toBe(1);

      const user = await User.find(1);
      expect(user?.name).toBe("Updated Name");
    });

    it("应该通过条件对象更新记录", async () => {
      const affected = await User.update(
        { email: "update@test.com" },
        { age: 26 },
      );
      expect(affected).toBe(1);

      const user = await User.find({ email: "update@test.com" });
      expect(user?.age).toBe(26);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Delete", email: "delete@test.com", age: 25 });
    });

    it("应该删除记录", async () => {
      const affected = await User.delete(1);
      expect(affected).toBe(1);

      const user = await User.find(1);
      expect(user).toBeNull();
    });

    it("应该通过条件对象删除记录", async () => {
      const affected = await User.delete({ email: "delete@test.com" });
      expect(affected).toBe(1);

      const user = await User.find({ email: "delete@test.com" });
      expect(user).toBeNull();
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Count1", email: "count1@test.com", age: 20 });
      await User.create({ name: "Count2", email: "count2@test.com", age: 25 });
      await User.create({ name: "Count3", email: "count3@test.com", age: 30 });
    });

    it("应该统计所有记录数", async () => {
      const count = await User.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("应该支持条件统计", async () => {
      const count = await User.count({ age: { $gt: 20 } });
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("exists", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Exists", email: "exists@test.com", age: 25 });
    });

    it("应该检查记录是否存在", async () => {
      const exists = await User.exists({ email: "exists@test.com" });
      expect(exists).toBe(true);
    });

    it("应该在记录不存在时返回 false", async () => {
      const exists = await User.exists({ email: "nonexistent@test.com" });
      expect(exists).toBe(false);
    });
  });

  describe("createMany", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    it("应该批量创建记录", async () => {
      const users = await User.createMany([
        { name: "Batch1", email: "batch1@test.com", age: 20 },
        { name: "Batch2", email: "batch2@test.com", age: 25 },
        { name: "Batch3", email: "batch3@test.com", age: 30 },
      ]);

      expect(users.length).toBe(3);
      expect(users[0].name).toBe("Batch1");
      expect(users[1].name).toBe("Batch2");
      expect(users[2].name).toBe("Batch3");
    });

    it("应该支持 enableHooks 选项", async () => {
      let beforeCreateCalled = 0;
      let afterCreateCalled = 0;
      let beforeSaveCalled = 0;
      let afterSaveCalled = 0;

      class UserWithHooks extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";

        static override async beforeCreate(instance: any) {
          beforeCreateCalled++;
          instance.hookData = "beforeCreate";
        }

        static override async afterCreate(instance: any) {
          afterCreateCalled++;
          instance.hookData = "afterCreate";
        }

        static override async beforeSave(instance: any) {
          beforeSaveCalled++;
        }

        static override async afterSave(instance: any) {
          afterSaveCalled++;
        }
      }
      UserWithHooks.setAdapter(adapter);

      // 默认不启用钩子
      await UserWithHooks.createMany([
        { name: "NoHooks1", email: "nohooks1@test.com", age: 20 },
        { name: "NoHooks2", email: "nohooks2@test.com", age: 25 },
      ]);
      expect(beforeCreateCalled).toBe(0);
      expect(afterCreateCalled).toBe(0);
      expect(beforeSaveCalled).toBe(0);
      expect(afterSaveCalled).toBe(0);

      // 启用钩子
      const users = await UserWithHooks.createMany([
        { name: "WithHooks1", email: "withhooks1@test.com", age: 20 },
        { name: "WithHooks2", email: "withhooks2@test.com", age: 25 },
      ], { enableHooks: true });
      expect(beforeCreateCalled).toBe(2);
      expect(afterCreateCalled).toBe(2);
      expect(beforeSaveCalled).toBe(2);
      expect(afterSaveCalled).toBe(2);
      expect(users[0].hookData).toBe("afterCreate");
      expect(users[1].hookData).toBe("afterCreate");
    });

    it("应该支持 enableValidation 选项", async () => {
      class UserWithValidation extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              format: "email",
            },
          },
          age: {
            type: "number",
            validate: {
              min: 18,
              max: 100,
            },
          },
        };
      }
      UserWithValidation.setAdapter(adapter);

      // 默认不启用验证，应该成功（即使数据不符合验证规则）
      await UserWithValidation.createMany([
        { name: "NoValidation1", email: "invalid-email", age: 10 },
        { name: "NoValidation2", email: "invalid-email2", age: 200 },
      ]);
      expect(true).toBe(true); // 如果没有抛出错误，测试通过

      // 启用验证，应该抛出错误
      await assertRejects(async () => {
        await UserWithValidation.createMany([
          { name: "WithValidation1", email: "invalid-email", age: 10 },
        ], { enableValidation: true });
      });
    });
  });

  describe("paginate", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      for (let i = 1; i <= 10; i++) {
        await User.create({
          name: `Page${i}`,
          email: `page${i}@test.com`,
          age: 20 + i,
        });
      }
    });

    it("应该返回分页结果", async () => {
      const result = await User.paginate({}, 1, 5);

      expect(result.data.length).toBe(5);
      expect(result.total).toBeGreaterThanOrEqual(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBeGreaterThanOrEqual(2);
    });

    it("应该支持自定义排序", async () => {
      const result = await User.paginate({}, 1, 5, { age: "desc" });

      expect(result.data.length).toBe(5);
      // 验证排序（降序）
      if (result.data.length > 1) {
        expect(result.data[0].age).toBeGreaterThanOrEqual(result.data[1].age);
      }
    });

    it("应该支持字段投影", async () => {
      const result = await User.paginate({}, 1, 5, { age: "asc" }, [
        "name",
        "email",
      ]);

      expect(result.data.length).toBe(5);
      // Bun 测试框架不支持 toHaveProperty，使用 in 操作符检查
      expect("name" in result.data[0]).toBe(true);
      expect("email" in result.data[0]).toBe(true);
      // 注意：age 不在投影中，所以不应该比较 age
      // 验证数据存在即可
      expect(result.data[0].name).toBeTruthy();
      expect(result.data[0].email).toBeTruthy();
    });

    it("应该支持软删除相关参数", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      // 创建并软删除一个用户
      const user = await SoftDeleteUser.create({
        name: "SoftDelete",
        email: "softdelete@test.com",
        age: 25,
      });
      await SoftDeleteUser.delete(user.id);

      // 默认不包含软删除的记录
      const result1 = await SoftDeleteUser.paginate({}, 1, 10);
      expect(result1.total).toBeLessThanOrEqual(10); // 可能正好等于 10

      // 包含软删除的记录
      const result2 = await SoftDeleteUser.paginate(
        {},
        1,
        10,
        { age: "asc" },
        undefined,
        true,
      );
      expect(result2.total).toBeGreaterThanOrEqual(result1.total);

      // 只查询软删除的记录
      const result3 = await SoftDeleteUser.paginate(
        {},
        1,
        10,
        { age: "asc" },
        undefined,
        false,
        true,
      );
      expect(result3.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe("increment 和 decrement", () => {
    let userId: number;

    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      const user = await User.create({
        name: "Inc",
        email: "inc@test.com",
        age: 25,
      });
      userId = user.id as number;
    });

    it("应该增加字段值", async () => {
      const result = await User.increment(userId, "age", 5);
      expect(typeof result).toBe("number");

      const user = await User.find(userId);
      expect(user?.age).toBe(30);
    });

    it("应该减少字段值", async () => {
      const result = await User.decrement(userId, "age", 5);
      expect(typeof result).toBe("number");

      const user = await User.find(userId);
      expect(user?.age).toBe(20);
    });
  });

  describe("upsert", () => {
    it("应该在记录不存在时创建", async () => {
      await adapter.execute("DELETE FROM users", []);

      const user = await User.upsert(
        { email: "upsert@test.com" },
        { name: "Upsert", email: "upsert@test.com", age: 25 },
      );

      expect(user).toBeTruthy();
      expect(user.name).toBe("Upsert");
    });

    it("应该在记录存在时更新", async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Old", email: "upsert@test.com", age: 20 });

      const user = await User.upsert(
        { email: "upsert@test.com" },
        { name: "New", email: "upsert@test.com", age: 25 },
      );

      expect(user.name).toBe("New");
      expect(user.age).toBe(25);
    });
  });

  describe("distinct", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "User1", email: "user1@test.com", age: 20 });
      await User.create({ name: "User2", email: "user2@test.com", age: 25 });
      await User.create({ name: "User3", email: "user3@test.com", age: 20 });
    });

    it("应该返回字段的唯一值列表", async () => {
      const ages = await User.distinct("age");
      expect(ages.length).toBeGreaterThan(0);
      expect(ages).toContain(20);
      expect(ages).toContain(25);
    });
  });

  describe("findOrCreate", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    it("应该在记录存在时返回现有记录", async () => {
      await User.create({
        name: "Existing",
        email: "existing@test.com",
        age: 25,
      });

      const user = await User.findOrCreate(
        { email: "existing@test.com" },
        { name: "New", email: "existing@test.com", age: 30 },
      );

      expect(user.name).toBe("Existing");
      expect(user.age).toBe(25);
    });

    it("应该在记录不存在时创建新记录", async () => {
      const user = await User.findOrCreate(
        { email: "new@test.com" },
        { name: "New", email: "new@test.com", age: 25 },
      );

      expect(user.name).toBe("New");
      expect(user.email).toBe("new@test.com");
    });
  });

  describe("实例方法", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    describe("save", () => {
      it("应该保存新实例", async () => {
        const user = new User();
        user.name = "Save";
        user.email = "save@test.com";
        user.age = 25;

        const saved = await user.save();
        expect(saved.id).toBeTruthy();
        expect(saved.name).toBe("Save");
      });

      it("应该更新现有实例", async () => {
        const created = await User.create({
          name: "Original",
          email: "original@test.com",
          age: 25,
        });

        created.name = "Updated";
        const saved = await created.save();

        expect(saved.name).toBe("Updated");
        const found = await User.find(created.id);
        expect(found?.name).toBe("Updated");
      });
    });

    describe("update (实例方法)", () => {
      it("应该更新实例", async () => {
        const user = await User.create({
          name: "Update Instance",
          email: "updateinstance@test.com",
          age: 25,
        });

        const updated = await user.update({ age: 26 });
        expect(updated.age).toBe(26);
      });
    });

    describe("delete (实例方法)", () => {
      it("应该删除实例", async () => {
        const user = await User.create({
          name: "Delete Instance",
          email: "deleteinstance@test.com",
          age: 25,
        });

        const deleted = await user.delete();
        expect(deleted).toBe(true);

        const found = await User.find(user.id);
        expect(found).toBeNull();
      });
    });
  });

  describe("软删除", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);

      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);
    });

    it("应该支持软删除", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "Soft Delete",
        email: "softdelete@test.com",
        age: 25,
      });

      const affected = await SoftDeleteUser.delete(user.id);
      expect(affected).toBe(1);

      // 记录应该被标记为删除，但不应在普通查询中出现
      const found = await SoftDeleteUser.find(user.id);
      expect(found).toBeNull();
    });
  });

  describe("updateById", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({
        name: "UpdateById",
        email: "updatebyid@test.com",
        age: 25,
      });
    });

    it("应该通过 ID 更新记录", async () => {
      const user = await User.findOne({ email: "updatebyid@test.com" });
      expect(user).toBeTruthy();

      const affected = await User.updateById(user!.id, { name: "UpdatedById" });
      expect(affected).toBe(1);

      const updated = await User.find(user!.id);
      expect(updated?.name).toBe("UpdatedById");
    });
  });

  describe("deleteById", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({
        name: "DeleteById",
        email: "deletebyid@test.com",
        age: 25,
      });
    });

    it("应该通过 ID 删除记录", async () => {
      const user = await User.findOne({ email: "deletebyid@test.com" });
      expect(user).toBeTruthy();

      const affected = await User.deleteById(user!.id);
      expect(affected).toBe(1);

      const found = await User.find(user!.id);
      expect(found).toBeNull();
    });
  });

  describe("updateMany", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({
        name: "User1",
        email: "user1@test.com",
        age: 20,
        status: "active",
      });
      await User.create({
        name: "User2",
        email: "user2@test.com",
        age: 25,
        status: "active",
      });
      await User.create({
        name: "User3",
        email: "user3@test.com",
        age: 30,
        status: "inactive",
      });
    });

    it("应该批量更新记录", async () => {
      const affected = await User.updateMany({ status: "active" }, {
        status: "updated",
      });
      expect(affected).toBe(2);

      const users = await User.findAll({ status: "updated" });
      expect(users.length).toBe(2);
    });

    it("应该支持 enableHooks 选项", async () => {
      let beforeUpdateCalled = 0;
      let afterUpdateCalled = 0;
      let beforeSaveCalled = 0;
      let afterSaveCalled = 0;

      class UserWithHooks extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";

        static override async beforeUpdate(instance: any) {
          beforeUpdateCalled++;
          instance.hookData = "beforeUpdate";
        }

        static override async afterUpdate(instance: any) {
          afterUpdateCalled++;
        }

        static override async beforeSave(instance: any) {
          beforeSaveCalled++;
        }

        static override async afterSave(instance: any) {
          afterSaveCalled++;
        }
      }
      UserWithHooks.setAdapter(adapter);

      // 创建测试数据（会调用 beforeSave 和 afterSave 钩子）
      await UserWithHooks.create({
        name: "HookUser1",
        email: "hookuser1@test.com",
        age: 20,
        status: "active",
      });
      await UserWithHooks.create({
        name: "HookUser2",
        email: "hookuser2@test.com",
        age: 25,
        status: "active",
      });

      // 重置计数器（因为 create 会调用钩子）
      beforeUpdateCalled = 0;
      afterUpdateCalled = 0;
      beforeSaveCalled = 0;
      afterSaveCalled = 0;

      // 默认不启用钩子（使用更具体的条件，避免与其他测试冲突）
      await UserWithHooks.updateMany({
        email: { $in: ["hookuser1@test.com", "hookuser2@test.com"] },
      }, {
        status: "updated",
      });
      expect(beforeUpdateCalled).toBe(0);
      expect(afterUpdateCalled).toBe(0);
      expect(beforeSaveCalled).toBe(0);
      expect(afterSaveCalled).toBe(0);

      // 启用钩子（使用更具体的条件，避免与其他测试冲突）
      const affected = await UserWithHooks.updateMany({
        email: { $in: ["hookuser1@test.com", "hookuser2@test.com"] },
      }, {
        status: "hooked",
      }, { enableHooks: true });
      expect(affected).toBe(2);
      expect(beforeUpdateCalled).toBeGreaterThanOrEqual(1);
      expect(beforeSaveCalled).toBeGreaterThanOrEqual(1);
      // afterUpdate 和 afterSave 在 updateMany 中会调用（如果启用钩子）
      expect(afterUpdateCalled).toBeGreaterThanOrEqual(1);
      expect(afterSaveCalled).toBeGreaterThanOrEqual(1);
    });

    it("应该支持 enableValidation 选项", async () => {
      class UserWithValidation extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              format: "email",
            },
          },
          age: {
            type: "number",
            validate: {
              min: 18,
              max: 100,
            },
          },
        };
      }
      UserWithValidation.setAdapter(adapter);

      // 创建测试数据
      await UserWithValidation.create({
        name: "ValidationUser1",
        email: "validationuser1@test.com",
        age: 20,
        status: "active",
      });
      await UserWithValidation.create({
        name: "ValidationUser2",
        email: "validationuser2@test.com",
        age: 25,
        status: "active",
      });

      // 默认不启用验证，应该成功（即使数据不符合验证规则）
      // 注意：不更新 email 字段，避免唯一性约束冲突（数据库层面的约束，不是验证问题）
      await UserWithValidation.updateMany({ status: "active" }, {
        age: 10,
      });
      expect(true).toBe(true); // 如果没有抛出错误，测试通过

      // 启用验证，应该抛出错误（email 格式不正确）
      await assertRejects(async () => {
        await UserWithValidation.updateMany({ status: "active" }, {
          email: "invalid-email-format",
          age: 10,
        }, { enableValidation: true });
      });
    });
  });

  describe("deleteMany", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      await User.create({
        name: "User1",
        email: "user1@test.com",
        age: 20,
        status: "active",
      });
      await User.create({
        name: "User2",
        email: "user2@test.com",
        age: 25,
        status: "active",
      });
      await User.create({
        name: "User3",
        email: "user3@test.com",
        age: 30,
        status: "inactive",
      });
    });

    it("应该批量删除记录", async () => {
      const affected = await User.deleteMany({ status: "active" });
      expect(affected).toBe(2);

      const users = await User.findAll({ status: "active" });
      expect(users.length).toBe(0);

      const remaining = await User.findAll();
      expect(remaining.length).toBe(1);
    });
  });

  describe("query 链式查询构建器", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
      for (let i = 1; i <= 10; i++) {
        await User.create({
          name: `User${i}`,
          email: `user${i}@test.com`,
          age: 20 + i,
          status: i % 2 === 0 ? "active" : "inactive",
        });
      }
    });

    it("应该支持链式查询", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .sort({ age: "desc" })
        .limit(3)
        .findAll();

      expect(users.length).toBe(3);
      expect(users[0].age).toBeGreaterThan(users[1].age);
    });

    it("应该支持链式查询 findOne", async () => {
      const user = await User.query()
        .where({ status: "active" })
        .sort({ age: "desc" })
        .findOne();

      expect(user).toBeTruthy();
      expect(user?.status).toBe("active");
    });

    it("应该支持链式查询 count", async () => {
      const count = await User.query()
        .where({ status: "active" })
        .count();

      expect(count).toBe(5);
    });

    it("应该支持链式查询 exists", async () => {
      const exists = await User.query()
        .where({ status: "active" })
        .exists();

      expect(exists).toBe(true);
    });

    it("应该支持链式查询 update", async () => {
      const affected = await User.query()
        .where({ status: "active" })
        .update({ status: "updated" });

      expect(affected).toBe(5);

      const updated = await User.findAll({ status: "updated" });
      expect(updated.length).toBe(5);
    });

    it("应该支持链式查询 deleteMany", async () => {
      const affected = await User.query()
        .where({ status: "inactive" })
        .deleteMany();

      expect(affected).toBe(5);

      const remaining = await User.findAll();
      expect(remaining.length).toBe(5);
    });

    it("应该支持链式查询 findById", async () => {
      const user1 = await User.create({
        name: "QueryFindById",
        email: "queryfindbyid@test.com",
        age: 25,
        status: "active",
      });

      const user = await User.query()
        .findById(user1.id);
      expect(user).toBeTruthy();
      expect(user?.id).toBe(user1.id);
    });

    it("应该支持链式查询 updateById", async () => {
      const user1 = await User.create({
        name: "UpdateById",
        email: "updatebyid@test.com",
        age: 25,
        status: "active",
      });

      const affected = await User.query()
        .updateById(user1.id, { name: "Updated" });
      expect(affected).toBe(1);

      const updated = await User.findById(user1.id);
      expect(updated?.name).toBe("Updated");
    });

    it("应该支持链式查询 deleteById", async () => {
      const user1 = await User.create({
        name: "DeleteById",
        email: "deletebyid@test.com",
        age: 25,
        status: "active",
      });

      const affected = await User.query()
        .deleteById(user1.id);
      expect(affected).toBe(1);

      const deleted = await User.findById(user1.id);
      expect(deleted).toBeNull();
    });

    it("应该支持链式查询 paginate", async () => {
      const result = await User.query()
        .where({ status: "active" })
        .sort({ age: "desc" })
        .paginate(1, 3);

      expect(result.data.length).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      // 验证排序
      if (result.data.length > 1) {
        expect(result.data[0].age).toBeGreaterThanOrEqual(result.data[1].age);
      }
    });

    it("应该支持链式查询 increment", async () => {
      const user1 = await User.create({
        name: "Increment",
        email: "increment@test.com",
        age: 25,
        status: "active",
      });

      const affected = await User.query()
        .where({ id: user1.id })
        .increment("age", 5);
      expect(affected).toBe(1);

      const updated = await User.findById(user1.id);
      expect(updated?.age).toBe(30);
    });

    it("应该支持链式查询 decrement", async () => {
      const user1 = await User.create({
        name: "Decrement",
        email: "decrement@test.com",
        age: 30,
        status: "active",
      });

      const affected = await User.query()
        .where({ id: user1.id })
        .decrement("age", 5);
      expect(affected).toBe(1);

      const updated = await User.findById(user1.id);
      expect(updated?.age).toBe(25);
    });

    it("应该支持链式查询 restore", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "Restore",
        email: "restore@test.com",
        age: 25,
      });
      await SoftDeleteUser.delete(user.id);

      const result = await SoftDeleteUser.query()
        .where({ id: user.id })
        .restore();
      expect(typeof result === "number" ? result : result.count)
        .toBeGreaterThanOrEqual(1);

      const restored = await SoftDeleteUser.find(user.id);
      expect(restored).toBeTruthy();
    });

    it("应该支持链式查询 forceDelete", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "ForceDelete",
        email: "forcedelete@test.com",
        age: 25,
      });

      const result = await SoftDeleteUser.query()
        .where({ id: user.id })
        .forceDelete();
      expect(typeof result === "number" ? result : result.count)
        .toBeGreaterThanOrEqual(1);

      // 强制删除后，即使包含软删除也找不到
      const deleted = await SoftDeleteUser.find(user.id, undefined, true);
      expect(deleted).toBeNull();
    });

    it("应该支持链式查询 distinct", async () => {
      const ages = await User.query()
        .where({ status: "active" })
        .distinct("age");
      expect(ages.length).toBeGreaterThan(0);
      expect(Array.isArray(ages)).toBe(true);
    });

    it("应该支持链式查询 upsert", async () => {
      const user = await User.query()
        .where({ email: "upsert@test.com" })
        .upsert({
          name: "Upsert",
          email: "upsert@test.com",
          age: 25,
        });
      expect(user).toBeTruthy();
      expect(user.email).toBe("upsert@test.com");

      // 再次调用应该更新
      const updated = await User.query()
        .where({ email: "upsert@test.com" })
        .upsert({
          name: "UpsertUpdated",
          email: "upsert@test.com",
          age: 26,
        });
      expect(updated.name).toBe("UpsertUpdated");
      expect(updated.age).toBe(26);
    });

    it("应该支持链式查询 findOrCreate", async () => {
      const user1 = await User.query()
        .where({ email: "findorcreate@test.com" })
        .findOrCreate({
          name: "FindOrCreate",
          email: "findorcreate@test.com",
          age: 25,
        });
      expect(user1).toBeTruthy();
      expect(user1.email).toBe("findorcreate@test.com");

      // 再次调用应该返回现有记录
      const user2 = await User.query()
        .where({ email: "findorcreate@test.com" })
        .findOrCreate({
          name: "FindOrCreateNew",
          email: "findorcreate@test.com",
          age: 30,
        });
      expect(user2.id).toBe(user1.id);
      expect(user2.name).toBe(user1.name); // 不会更新
    });

    it("应该支持链式查询 findOneAndUpdate", async () => {
      const user1 = await User.create({
        name: "FindOneAndUpdate",
        email: "findoneandupdate@test.com",
        age: 25,
        status: "active",
      });

      const updated = await User.query()
        .where({ id: user1.id })
        .findOneAndUpdate({ name: "Updated" });
      expect(updated).toBeTruthy();
      expect(updated?.name).toBe("Updated");
    });

    it("应该支持链式查询 findOneAndDelete", async () => {
      const user1 = await User.create({
        name: "FindOneAndDelete",
        email: "findoneanddelete@test.com",
        age: 25,
        status: "active",
      });

      const deleted = await User.query()
        .where({ id: user1.id })
        .findOneAndDelete();
      expect(deleted).toBeTruthy();
      expect(deleted?.id).toBe(user1.id);

      const found = await User.findById(user1.id);
      expect(found).toBeNull();
    });
  });

  describe("软删除相关方法", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    it("应该支持 restore 恢复软删除记录", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "Restore",
        email: "restore@test.com",
        age: 25,
      });

      // 软删除
      await SoftDeleteUser.delete(user.id);

      // 验证已删除
      const found = await SoftDeleteUser.find(user.id);
      expect(found).toBeNull();

      // 恢复
      const restored = await SoftDeleteUser.restore({ id: user.id });
      expect(restored).toBeGreaterThan(0);

      // 验证已恢复
      const restoredUser = await SoftDeleteUser.find(user.id);
      expect(restoredUser).toBeTruthy();
    });

    it("应该支持 forceDelete 强制删除", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "ForceDelete",
        email: "forcedelete@test.com",
        age: 25,
      });

      // 强制删除
      const affected = await SoftDeleteUser.forceDelete({ id: user.id });
      expect(affected).toBeGreaterThan(0);

      // 验证已彻底删除（包括软删除查询）
      const found = await SoftDeleteUser.find(user.id);
      expect(found).toBeNull();
    });

    it("应该支持 onlyTrashed 仅查询已删除记录", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "User1",
        email: "user1@test.com",
        age: 25,
      });
      const user2 = await SoftDeleteUser.create({
        name: "User2",
        email: "user2@test.com",
        age: 30,
      });

      // 删除 user1
      await SoftDeleteUser.delete(user1.id);

      // 仅查询已删除的记录
      const trashed = await SoftDeleteUser.onlyTrashed().findAll();
      expect(trashed.length).toBe(1);
      expect(trashed[0].id).toBe(user1.id);
    });

    it("应该支持 includeTrashed 包含已删除记录", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "users";
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "User1",
        email: "user1@test.com",
        age: 25,
      });
      const user2 = await SoftDeleteUser.create({
        name: "User2",
        email: "user2@test.com",
        age: 30,
      });

      // 删除 user1
      await SoftDeleteUser.delete(user1.id);

      // 使用 query 链式查询包含已删除的记录
      const all = await SoftDeleteUser.query()
        .includeTrashed()
        .findAll();
      expect(all.length).toBe(2);
    });
  });

  describe("缓存集成", () => {
    it("应该支持查询结果缓存", async () => {
      const { MemoryAdapter } = await import("@dreamer/cache");
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      await adapter.execute("DELETE FROM users", []);
      await User.create({ name: "Cache", email: "cache@test.com", age: 25 });

      // 第一次查询应该从数据库获取
      const user1 = await User.find({ email: "cache@test.com" });
      expect(user1).toBeTruthy();

      // 第二次查询应该从缓存获取（需要验证缓存逻辑）
      // 注意：这里只是测试缓存适配器已设置，实际缓存行为需要更复杂的测试
      expect(User.cacheAdapter).toBe(cacheAdapter);
    });
  });

  describe("生命周期钩子", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    it("应该调用 beforeCreate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static beforeCreateCalled = false;
        static beforeCreateData: any = null;

        static override async beforeCreate(instance: any) {
          HookUser.beforeCreateCalled = true;
          HookUser.beforeCreateData = instance;
          instance.status = "created_by_hook";
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      expect(HookUser.beforeCreateCalled).toBe(true);
      expect(HookUser.beforeCreateData).toBeTruthy();
      expect(user.status).toBe("created_by_hook");
    });

    it("应该调用 afterCreate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static afterCreateCalled = false;
        static afterCreateData: any = null;

        static override async afterCreate(instance: any) {
          HookUser.afterCreateCalled = true;
          HookUser.afterCreateData = instance;
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      expect(HookUser.afterCreateCalled).toBe(true);
      expect(HookUser.afterCreateData).toBeTruthy();
      expect(HookUser.afterCreateData.id).toBe(user.id);
    });

    it("应该调用 beforeUpdate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static beforeUpdateCalled = false;

        static override async beforeUpdate(instance: any) {
          HookUser.beforeUpdateCalled = true;
          instance.status = "updated_by_hook";
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      await HookUser.update(user.id, { name: "Updated" });

      expect(HookUser.beforeUpdateCalled).toBe(true);
      const updated = await HookUser.find(user.id);
      expect(updated?.status).toBe("updated_by_hook");
    });

    it("应该调用 afterUpdate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static afterUpdateCalled = false;

        static override async afterUpdate(instance: any) {
          HookUser.afterUpdateCalled = true;
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      await HookUser.update(user.id, { name: "Updated" });

      expect(HookUser.afterUpdateCalled).toBe(true);
    });

    it("应该调用 beforeSave 钩子（实例方法）", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static beforeSaveCalled = false;

        static override async beforeSave(instance: any) {
          HookUser.beforeSaveCalled = true;
          instance.status = "saved_by_hook";
        }
      }
      HookUser.setAdapter(adapter);

      const user = new HookUser();
      user.name = "HookTest";
      user.email = "hook@test.com";
      user.age = 25;
      await user.save();

      expect(HookUser.beforeSaveCalled).toBe(true);
      expect(user.status).toBe("saved_by_hook");
    });

    it("应该调用 afterSave 钩子（实例方法）", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static afterSaveCalled = false;

        static override async afterSave(instance: any) {
          HookUser.afterSaveCalled = true;
        }
      }
      HookUser.setAdapter(adapter);

      const user = new HookUser();
      user.name = "HookTest";
      user.email = "hook@test.com";
      user.age = 25;
      await user.save();

      expect(HookUser.afterSaveCalled).toBe(true);
    });

    it("应该调用 beforeDelete 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static beforeDeleteCalled = false;

        static override async beforeDelete(instance: any) {
          HookUser.beforeDeleteCalled = true;
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      await HookUser.delete(user.id);

      expect(HookUser.beforeDeleteCalled).toBe(true);
    });

    it("应该调用 afterDelete 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static afterDeleteCalled = false;

        static override async afterDelete(instance: any) {
          HookUser.afterDeleteCalled = true;
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      await HookUser.delete(user.id);

      expect(HookUser.afterDeleteCalled).toBe(true);
    });

    it("应该调用 beforeValidate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static beforeValidateCalled = false;

        static override async beforeValidate(instance: any) {
          HookUser.beforeValidateCalled = true;
          instance.status = "validated_by_hook";
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      expect(HookUser.beforeValidateCalled).toBe(true);
      expect(user.status).toBe("validated_by_hook");
    });

    it("应该调用 afterValidate 钩子", async () => {
      class HookUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static afterValidateCalled = false;

        static override async afterValidate(instance: any) {
          HookUser.afterValidateCalled = true;
        }
      }
      HookUser.setAdapter(adapter);

      const user = await HookUser.create({
        name: "HookTest",
        email: "hook@test.com",
        age: 25,
      });

      expect(HookUser.afterValidateCalled).toBe(true);
    });
  });

  describe("数据验证", () => {
    beforeEach(async () => {
      await adapter.execute("DELETE FROM users", []);
    });

    it("应该验证必填字段", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          name: {
            type: "string",
            validate: { required: true },
          },
          email: {
            type: "string",
            validate: { required: true },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 缺少必填字段应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({ name: "Test" } as any);
        },
        Error,
      );

      // 提供所有必填字段应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证字段类型", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          age: {
            type: "number",
            validate: { type: "number" },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 类型错误应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: "not_a_number" as any,
          });
        },
        Error,
      );

      // 正确类型应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 25,
      });
      expect(user.age).toBe(25);
    });

    it("应该验证最小值", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          age: {
            type: "number",
            validate: { min: 18 },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 小于最小值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 15,
          });
        },
        Error,
      );

      // 大于等于最小值应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 20,
      });
      expect(user.age).toBe(20);
    });

    it("应该验证最大值", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          age: {
            type: "number",
            validate: { max: 100 },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 大于最大值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 150,
          });
        },
        Error,
      );

      // 小于等于最大值应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 50,
      });
      expect(user.age).toBe(50);
    });

    it("应该验证正则表达式", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 不符合正则表达式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "invalid_email",
          });
        },
        Error,
      );

      // 符合正则表达式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@example.com",
      });
      expect(user.email).toBe("test@example.com");
    });

    it("应该验证枚举值", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          status: {
            type: "enum",
            enum: ["active", "inactive", "pending"],
            validate: {
              enum: ["active", "inactive", "pending"],
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 不在枚举值中应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            status: "invalid" as any,
          });
        },
        Error,
      );

      // 在枚举值中应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        status: "active",
      });
      expect(user.status).toBe("active");
    });

    it("应该验证自定义验证函数", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          age: {
            type: "number",
            validate: {
              custom: (value: any) => {
                if (value < 0 || value > 150) {
                  return "年龄必须在 0-150 之间";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 自定义验证失败应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            age: 200,
          });
        },
        Error,
      );

      // 自定义验证通过应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        age: 25,
      });
      expect(user.age).toBe(25);
    });

    it("应该验证跨字段相等（equals）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          password: {
            type: "string",
            validate: { required: true },
          },
          confirmPassword: {
            type: "string",
            validate: {
              required: true,
              equals: "password",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 密码不匹配应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            password: "password123",
            confirmPassword: "password456",
          });
        },
        Error,
      );

      // 密码匹配应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证跨字段不相等（notEquals）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          oldPassword: {
            type: "string",
            validate: { required: true },
          },
          newPassword: {
            type: "string",
            validate: {
              required: true,
              notEquals: "oldPassword",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 新旧密码相同应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            oldPassword: "password123",
            newPassword: "password123",
          });
        },
        Error,
      );

      // 新旧密码不同应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        oldPassword: "password123",
        newPassword: "password456",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证跨字段自定义比较（compare）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          startDate: {
            type: "date",
            validate: { required: true },
          },
          endDate: {
            type: "date",
            validate: {
              required: true,
              compare: (value, allValues) => {
                if (value <= allValues.startDate) {
                  return "结束日期必须大于开始日期";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 结束日期小于等于开始日期应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            startDate: "2024-12-31",
            endDate: "2024-12-30",
          });
        },
        Error,
      );

      // 结束日期大于开始日期应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证唯一性（unique）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              unique: true,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建第一个用户应该成功
      const user1 = await ValidatedUser.create({
        name: "Test1",
        email: "test@test.com",
      });
      expect(user1).toBeTruthy();

      // 创建相同邮箱的用户应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test@test.com",
          });
        },
        Error,
      );

      // 更新时排除当前记录应该成功（需要提供 email，因为它是必填字段）
      await ValidatedUser.update(user1.id, {
        name: "Test1 Updated",
        email: "test@test.com", // 保持相同的 email
      });
    });

    it("应该验证存在性（exists）", async () => {
      // 先创建一个分类表
      await adapter.execute(
        "CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255))",
        [],
      );
      await adapter.execute(
        "INSERT INTO categories (name) VALUES (?)",
        ["Test Category"],
      );

      class Category extends SQLModel {
        static override tableName = "categories";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          name: { type: "string" },
        };
      }
      Category.setAdapter(adapter);

      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          categoryId: {
            type: "number",
            validate: {
              required: true,
              exists: {
                table: "categories",
                where: { id: null }, // 将在验证时替换为实际值
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 不存在的分类ID应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            categoryId: 999,
          });
        },
        Error,
      );

      // 存在的分类ID应该成功
      const category = await Category.findOne({ name: "Test Category" });
      if (category) {
        const user = await ValidatedUser.create({
          name: "Test",
          email: "test@test.com",
          categoryId: category.id,
        });
        expect(user).toBeTruthy();
      }
    });

    it("应该验证不存在性（notExists）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              notExists: {
                table: "banned_emails",
                where: {},
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建被禁止邮箱表
      await adapter.execute(
        "CREATE TABLE IF NOT EXISTS banned_emails (id SERIAL PRIMARY KEY, email VARCHAR(255))",
        [],
      );
      await adapter.execute(
        "INSERT INTO banned_emails (email) VALUES (?)",
        ["banned@test.com"],
      );

      // 使用被禁止的邮箱应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "banned@test.com",
          });
        },
        Error,
      );

      // 使用未被禁止的邮箱应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "allowed@test.com",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证条件验证（when）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          hasDiscount: {
            type: "boolean",
            validate: { required: true },
          },
          discountCode: {
            type: "string",
            validate: {
              when: {
                field: "hasDiscount",
                is: true,
              },
              required: true,
              min: 3,
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // hasDiscount 为 false 时，discountCode 不需要验证
      const user1 = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        hasDiscount: false,
      });
      expect(user1).toBeTruthy();

      // hasDiscount 为 true 时，discountCode 必须提供且符合规则
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test2@test.com",
            hasDiscount: true,
            discountCode: "AB", // 太短
          });
        },
        Error,
      );

      // hasDiscount 为 true 时，discountCode 符合规则应该成功
      const user2 = await ValidatedUser.create({
        name: "Test3",
        email: "test3@test.com",
        hasDiscount: true,
        discountCode: "ABC123",
      });
      expect(user2).toBeTruthy();
    });

    it("应该验证条件必填（requiredWhen）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          userType: {
            type: "string",
            validate: { required: true },
          },
          companyName: {
            type: "string",
            validate: {
              requiredWhen: {
                field: "userType",
                is: "company",
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // userType 为 "individual" 时，companyName 不是必填
      const user1 = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        userType: "individual",
      });
      expect(user1).toBeTruthy();

      // userType 为 "company" 时，companyName 是必填
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test2@test.com",
            userType: "company",
          });
        },
        Error,
      );

      // userType 为 "company" 且提供了 companyName 应该成功
      const user2 = await ValidatedUser.create({
        name: "Test3",
        email: "test3@test.com",
        userType: "company",
        companyName: "Test Company",
      });
      expect(user2).toBeTruthy();
    });

    it("应该验证异步自定义验证（asyncCustom）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          username: {
            type: "string",
            validate: {
              required: true,
              asyncCustom: async (value, allValues, context) => {
                // 检查用户名是否已存在（排除当前记录）
                const existing = await context.model
                  .query()
                  .where({ username: value })
                  .findOne();
                if (
                  existing && context.instanceId &&
                  existing.id !== parseInt(context.instanceId)
                ) {
                  return "用户名已存在";
                }
                if (existing && !context.instanceId) {
                  return "用户名已存在";
                }
                return true;
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 创建第一个用户应该成功
      const user1 = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        username: "testuser",
      });
      expect(user1).toBeTruthy();

      // 创建相同用户名的用户应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test2",
            email: "test2@test.com",
            username: "testuser",
          });
        },
        Error,
      );

      // 更新时使用相同用户名（排除当前记录）应该成功
      await ValidatedUser.update(user1.id, {
        username: "testuser",
      });
    });

    it("应该验证验证组（groups）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          password: {
            type: "string",
            validate: {
              required: true,
              min: 8,
              groups: ["create", "update"],
            },
          },
          email: {
            type: "string",
            validate: {
              required: true,
              groups: ["create"],
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 使用 "create" 组验证，password 和 email 都应该验证
      await assertRejects(
        async () => {
          await ValidatedUser.validate(
            { password: "123", email: "test@test.com" },
            undefined,
            ["create"],
          );
        },
        Error,
      );

      // 使用 "update" 组验证，只验证 password
      await assertRejects(
        async () => {
          await ValidatedUser.validate(
            { password: "123" },
            undefined,
            ["update"],
          );
        },
        Error,
      );

      // 不使用组验证，所有字段都应该验证
      await assertRejects(
        async () => {
          await ValidatedUser.validate({ password: "123" }, undefined);
        },
        Error,
      );
    });

    it("应该验证数组（array）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          tags: {
            type: "array",
            validate: {
              array: {
                type: "string",
                min: 1,
                max: 5,
                items: {
                  min: 2,
                  max: 20,
                },
              },
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 数组长度小于最小值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: [],
          });
        },
        Error,
      );

      // 数组长度大于最大值应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
          });
        },
        Error,
      );

      // 数组元素长度不符合要求应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            tags: ["a"], // 太短
          });
        },
        Error,
      );

      // 符合所有要求的数组应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        tags: ["tag1", "tag2", "tag3"],
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - email）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          email: {
            type: "string",
            validate: {
              required: true,
              format: "email",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的邮箱格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "invalid_email",
          });
        },
        Error,
      );

      // 有效的邮箱格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@example.com",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - url）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          website: {
            type: "string",
            validate: {
              format: "url",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 URL 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            website: "not_a_url",
          });
        },
        Error,
      );

      // 有效的 URL 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        website: "https://example.com",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - uuid）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          uuid: {
            type: "string",
            validate: {
              format: "uuid",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 UUID 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            uuid: "not-a-uuid",
          });
        },
        Error,
      );

      // 有效的 UUID 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - ipv4）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          ip: {
            type: "string",
            validate: {
              format: "ipv4",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的 IPv4 格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            ip: "999.999.999.999",
          });
        },
        Error,
      );

      // 有效的 IPv4 格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        ip: "192.168.1.1",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - date）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          birthDate: {
            type: "string",
            validate: {
              format: "date",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的日期格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            birthDate: "not-a-date",
          });
        },
        Error,
      );

      // 有效的日期格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        birthDate: "2024-01-01",
      });
      expect(user).toBeTruthy();
    });

    it("应该验证格式验证器（format - time）", async () => {
      class ValidatedUser extends SQLModel {
        static override tableName = "users";
        static override primaryKey = "id";
        static schema: ModelSchema = {
          workTime: {
            type: "string",
            validate: {
              format: "time",
            },
          },
        };
      }
      ValidatedUser.setAdapter(adapter);

      // 无效的时间格式应该抛出错误
      await assertRejects(
        async () => {
          await ValidatedUser.create({
            name: "Test",
            email: "test@test.com",
            workTime: "25:00:00",
          });
        },
        Error,
      );

      // 有效的时间格式应该成功
      const user = await ValidatedUser.create({
        name: "Test",
        email: "test@test.com",
        workTime: "09:00:00",
      });
      expect(user.workTime).toBe("09:00:00");
    });
  });

  describe("withTrashed", () => {
    beforeEach(async () => {
      // 在每个测试前清理软删除测试表的数据
      // 先删除表（如果存在），然后重新创建，确保干净的状态
      await adapter.execute("DROP TABLE IF EXISTS soft_delete_users", []).catch(
        () => {
          // 如果删除失败，忽略错误
        },
      );
      // 创建专门的软删除测试表
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS soft_delete_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          "deletedAt" TIMESTAMP
        )`,
        [],
      );
    });

    it("应该包含已删除记录的查询（静态方法）", async () => {
      class SoftDeleteUser extends SQLModel {
        static override tableName = "soft_delete_users";
        static override primaryKey = "id";
        static override softDelete = true;
        static override deletedAtField = "deletedAt";
      }
      SoftDeleteUser.setAdapter(adapter);

      // 创建用户
      const user1 = await SoftDeleteUser.create({
        name: "SoftDelete User 1",
        email: "soft1@example.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "SoftDelete User 2",
        email: "soft2@example.com",
      });

      // 删除一个用户
      await SoftDeleteUser.deleteById(user1.id);

      // 正常查询应该不包含已删除的记录
      const normalUsers = await SoftDeleteUser.findAll();
      expect(normalUsers.length).toBe(1);
      expect(normalUsers[0].id).toBe(user2.id);

      // withTrashed 应该包含已删除的记录
      const allUsers = await SoftDeleteUser.withTrashed().findAll();
      expect(allUsers.length).toBe(2);

      // 验证包含已删除的记录
      const deletedUser = allUsers.find((u) => u.id === user1.id);
      expect(deletedUser).toBeTruthy();
      expect(deletedUser?.deletedAt).toBeTruthy();
    });

    it("应该支持条件查询", async () => {
      // 使用同一个表（已在 beforeEach 中创建）
      class SoftDeleteUser extends SQLModel {
        static override tableName = "soft_delete_users";
        static override primaryKey = "id";
        static override softDelete = true;
        static override deletedAtField = "deletedAt";
      }
      SoftDeleteUser.setAdapter(adapter);

      // 创建并删除用户
      const user = await SoftDeleteUser.create({
        name: "Chain Test",
        email: "chain@example.com",
      });
      await SoftDeleteUser.deleteById(user.id);

      // 使用条件查询
      const result = await SoftDeleteUser.withTrashed().find({
        email: "chain@example.com",
      });

      expect(result).toBeTruthy();
      expect(result?.id).toBe(user.id);
      expect(result?.deletedAt).toBeTruthy();
    });
  });
}, {
  // MariaDB 客户端库可能有内部定时器和资源，禁用泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
