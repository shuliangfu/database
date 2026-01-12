/**
 * @fileoverview SQLModel 测试
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
import { SQLiteAdapter } from "../src/adapters/sqlite.ts";
import { type ModelSchema, SQLModel } from "../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../src/types.ts";

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
    adapter = new SQLiteAdapter();
    await adapter.connect({
      type: "sqlite",
      connection: { filename: ":memory:" },
    });

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME
      )`,
      [],
    );

    // 设置模型适配器
    User.setAdapter(adapter);
  });

  afterAll(async () => {
    await adapter?.close();
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
    it("应该批量创建记录", async () => {
      await adapter.execute("DELETE FROM users", []);

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
  });
});
