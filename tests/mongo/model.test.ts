/**
 * @fileoverview MongoModel MongoDB 测试 - 基于最新统一接口
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

// 定义集合名常量
const COLLECTION_NAME = "mongo_model_users";
const COLLECTION_SOFT_DELETE = "mongo_model_soft_delete_users";
const COLLECTION_CATEGORIES = "mongo_model_categories";
const COLLECTION_POSTS = "mongo_model_posts";
const COLLECTION_PROFILES = "mongo_model_profiles";

/**
 * 测试用户模型
 */
class User extends MongoModel {
  static override collectionName = COLLECTION_NAME;
  static override primaryKey = "_id";
}

describe("MongoModel MongoDB", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 获取 MongoDB 连接配置
      const mongoHost = getEnvWithDefault("MONGO_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGO_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGO_DATABASE", "test");

      // 初始化数据库
      await initDatabase({
        type: "mongodb",
        connection: {
          host: mongoHost,
          port: mongoPort,
          database: mongoDatabase,
        },
        mongoOptions: {
          serverSelectionTimeoutMS: 5000,
          directConnection: true,
        },
      });

      adapter = getDatabase();

      // MongoDB 不需要创建表，集合会在首次插入时自动创建
      // 清理现有数据
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_NAME).deleteMany({});
        await db.collection(COLLECTION_SOFT_DELETE).deleteMany({});
      }

      User.setAdapter(adapter);
    } catch (error) {
      console.log("MongoDB not available, skipping model tests");
      console.error(error);
    }
  });

  afterAll(async () => {
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  // 辅助函数：清理集合数据
  async function clearCollection(collectionName: string) {
    if (!adapter) return;
    const db = (adapter as any)?.getDatabase();
    if (db) {
      await db.collection(collectionName).deleteMany({});
    }
  }

  // ==================== 基础查询方法 ====================

  describe("find", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该通过 ID 查找记录", async () => {
      const user = await User.create({
        name: "Find Test",
        email: "find@test.com",
        age: 25,
      });

      const found = await User.find(user._id);
      expect(found).toBeTruthy();
      expect(found?.name).toBe("Find Test");
    });

    it("应该通过条件对象查找记录", async () => {
      await User.create({
        name: "Find Condition",
        email: "findcondition@test.com",
        age: 30,
      });

      const found = await User.find({ email: "findcondition@test.com" });
      expect(found).toBeTruthy();
      expect(found?.age).toBe(30);
    });

    it("应该在记录不存在时返回 null", async () => {
      // MongoDB 使用 ObjectId，这里使用一个不存在的 ObjectId 字符串
      const found = await User.find("507f1f77bcf86cd799439011");
      expect(found).toBeNull();
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "FindOne Test",
        email: "findone@test.com",
        age: 25,
      });
    });

    it("应该查找单条记录", async () => {
      const user = await User.findOne({ email: "findone@test.com" });
      expect(user).toBeTruthy();
      expect(user?.name).toBe("FindOne Test");
    });

    it("应该在记录不存在时返回 null", async () => {
      const user = await User.findOne({ email: "nonexistent@test.com" });
      expect(user).toBeNull();
    });
  });

  describe("findById", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "FindById Test",
        email: "findbyid@test.com",
        age: 25,
      });
    });

    it("应该通过 ID 查找记录", async () => {
      const created = await User.findOne({ email: "findbyid@test.com" });
      const user = await User.findById(created!._id);
      expect(user).toBeTruthy();
      expect(user?.name).toBe("FindById Test");
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({ name: "Count1", email: "count1@test.com", age: 20 });
      await User.create({ name: "Count2", email: "count2@test.com", age: 25 });
    });

    it("应该统计所有记录数", async () => {
      const count = await User.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("应该支持条件统计", async () => {
      const count = await User.count({ age: { $gt: 20 } });
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("exists", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Exists Test",
        email: "exists@test.com",
        age: 25,
      });
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

  describe("distinct", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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

  describe("paginate", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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
      if (result.data.length > 1) {
        expect(result.data[0].age).toBeGreaterThanOrEqual(
          result.data[1].age,
        );
      }
    });
  });

  // ==================== 创建方法 ====================

  describe("create", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该创建新记录", async () => {
      const user = await User.create({
        name: "Create Test",
        email: "create@test.com",
        age: 25,
      });

      expect(user).toBeTruthy();
      expect(user._id).toBeTruthy();
      expect(user.name).toBe("Create Test");
    });
  });

  describe("createMany", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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
  });

  // ==================== 更新方法 ====================

  describe("update", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Update Test",
        email: "update@test.com",
        age: 25,
      });
    });

    it("应该更新记录（通过 ID）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "update@test.com" });
      const affected = await User.update(user!._id, { name: "Updated Name" });
      expect(affected).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.name).toBe("Updated Name");
    });

    it("应该更新记录（通过条件对象）", async () => {
      const affected = await User.update(
        { email: "update@test.com" },
        { age: 26 },
      );
      expect(affected).toBe(1);

      const updated = await User.find({ email: "update@test.com" });
      expect(updated?.age).toBe(26);
    });

    it("应该支持 returnLatest 选项", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "update@test.com" });
      const result = await User.update(
        user!._id,
        { name: "Updated", age: 30 },
        true, // returnLatest
      );

      expect(typeof result).toBe("object");
      expect((result as any).name).toBe("Updated");
      expect((result as any).age).toBe(30);
    });
  });

  describe("updateById", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "UpdateById Test",
        email: "updatebyid@test.com",
        age: 25,
      });
    });

    it("应该通过 ID 更新记录", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "updatebyid@test.com" });
      const affected = await User.updateById(user!._id, {
        name: "UpdatedById",
      });
      expect(affected).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.name).toBe("UpdatedById");
    });
  });

  describe("updateMany", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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

  // ==================== 删除方法 ====================

  describe("delete", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Delete Test",
        email: "delete@test.com",
        age: 25,
      });
    });

    it("应该删除记录（通过 ID）", async () => {
      const user = await User.findOne({ email: "delete@test.com" });
      const affected = await User.delete(user!._id);
      expect(affected).toBe(1);

      const found = await User.find(user!.id);
      expect(found).toBeNull();
    });

    it("应该删除记录（通过条件对象）", async () => {
      const affected = await User.delete({ email: "delete@test.com" });
      expect(affected).toBe(1);

      const found = await User.find({ email: "delete@test.com" });
      expect(found).toBeNull();
    });
  });

  describe("deleteById", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "DeleteById Test",
        email: "deletebyid@test.com",
        age: 25,
      });
    });

    it("应该通过 ID 删除记录", async () => {
      const user = await User.findOne({ email: "deletebyid@test.com" });
      const affected = await User.deleteById(user!._id);
      expect(affected).toBe(1);

      const found = await User.find(user!.id);
      expect(found).toBeNull();
    });
  });

  describe("deleteMany", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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
    });

    it("应该批量删除记录", async () => {
      const affected = await User.deleteMany({ status: "active" });
      expect(affected).toBe(2);

      const users = await User.findAll({ status: "active" });
      expect(users.length).toBe(0);
    });

    it("应该支持 returnIds 选项", async () => {
      const user1 = await User.create({
        name: "DeleteMany1",
        email: "deletemany1@test.com",
        age: 25,
      });
      const user2 = await User.create({
        name: "DeleteMany2",
        email: "deletemany2@test.com",
        age: 25,
      });

      const result = await User.deleteMany(
        { _id: { $in: [user1._id, user2._id] } },
        { returnIds: true },
      );

      if (typeof result === "object" && "count" in result) {
        expect(result.count).toBe(2);
        expect(result.ids.length).toBe(2);
      } else {
        throw new Error("Expected object with count and ids");
      }
    });
  });

  // ==================== 自增自减方法 ====================

  describe("increment", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Increment Test",
        email: "increment@test.com",
        age: 25,
      });
    });

    it("应该增加字段值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "increment@test.com" });
      // 测试对象格式
      const result = await User.increment(user!._id, { age: 5 });
      expect(result).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.age).toBe(30);
    });

    it("应该支持单个字段格式", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "increment@test.com" });
      const result = await User.increment(user!._id, "age", 3);
      expect(result).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.age).toBe(28); // 25 + 3 = 28
    });

    it("应该支持对象格式的 returnLatest 选项", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "increment@test.com" });
      // 测试对象格式的 returnLatest
      const result = await User.increment(
        user!._id,
        { age: 2 },
        true, // returnLatest
      );
      expect(typeof result).toBe("object");
      expect((result as any).age).toBe(27); // 25 + 2 = 27
    });
  });

  describe("decrement", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Decrement Test",
        email: "decrement@test.com",
        age: 30,
      });
    });

    it("应该减少字段值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "decrement@test.com" });
      // 测试对象格式
      const result = await User.decrement(user!._id, { age: 5 });
      expect(result).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.age).toBe(25);
    });

    it("应该支持单个字段格式", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "decrement@test.com" });
      const result = await User.decrement(user!._id, "age", 3);
      expect(result).toBe(1);

      const updated = await User.find(user!._id);
      expect(updated?.age).toBe(27); // 30 - 3 = 27
    });

    it("应该支持对象格式的 returnLatest 选项", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const user = await User.findOne({ email: "decrement@test.com" });
      // 测试对象格式的 returnLatest
      const result = await User.decrement(
        user!._id,
        { age: 2 },
        true, // returnLatest
      );
      expect(typeof result).toBe("object");
      expect((result as any).age).toBe(28); // 30 - 2 = 28
    });
  });

  describe("incrementMany", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      // MongoDB 不需要 ALTER TABLE，字段会自动添加
    });

    it("应该批量自增多个字段", async () => {
      const user = await User.create({
        name: "IncrementMany",
        email: "incrementmany@test.com",
        age: 25,
        score: 10,
      });

      const affected = await User.incrementMany(
        { _id: user._id },
        { age: 5, score: 10 },
      );
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(30);
      expect((updated as any)?.score).toBe(20);
    });

    it("应该支持单个字段自增", async () => {
      const user = await User.create({
        name: "IncrementManySingle",
        email: "incrementmanysingle@test.com",
        age: 25,
      });

      const affected = await User.incrementMany(
        { _id: user._id },
        "age",
        5,
      );
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(30);
    });
  });

  describe("decrementMany", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该批量自减多个字段", async () => {
      const user = await User.create({
        name: "DecrementMany",
        email: "decrementmany@test.com",
        age: 30,
      });

      const affected = await User.decrementMany(
        { _id: user._id },
        { age: 5 },
      );
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(25);
    });

    it("应该支持单个字段自减", async () => {
      const user = await User.create({
        name: "DecrementManySingle",
        email: "decrementmanysingle@test.com",
        age: 30,
      });

      const affected = await User.decrementMany(
        { _id: user._id },
        "age",
        5,
      );
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(25);
    });
  });

  // ==================== 特殊操作方法 ====================

  describe("upsert", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该在记录不存在时创建", async () => {
      const user = await User.upsert(
        { email: "upsert@test.com" },
        { name: "Upsert", email: "upsert@test.com", age: 25 },
      );

      expect(user).toBeTruthy();
      expect(user.name).toBe("Upsert");
    });

    it("应该在记录存在时更新", async () => {
      await User.create({
        name: "Old",
        email: "upsert@test.com",
        age: 20,
      });

      const user = await User.upsert(
        { email: "upsert@test.com" },
        { name: "New", email: "upsert@test.com", age: 25 },
      );

      expect(user.name).toBe("New");
      expect(user.age).toBe(25);
    });

    it("应该支持 returnLatest 参数", async () => {
      const user = await User.create({
        name: "UpsertReturnLatest",
        email: "upsertreturnlatest@test.com",
        age: 25,
      });

      const updated = await User.upsert(
        { _id: user._id },
        { name: "Updated", age: 30 },
        true, // returnLatest
        false, // resurrect
      );

      expect(updated).toBeTruthy();
      expect(updated.name).toBe("Updated");
      expect(updated.age).toBe(30);
    });

    it("应该支持 resurrect 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "UpsertResurrect",
        email: "upsertresurrect@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const updated = await SoftDeleteUser.upsert(
        { _id: user._id },
        { name: "Resurrected" },
        true, // returnLatest
        true, // resurrect
      );

      expect(updated).toBeTruthy();
      expect(updated.name).toBe("Resurrected");
      expect((updated as any).deleted_at).toBeUndefined();
    });
  });

  describe("findOrCreate", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
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

    it("应该支持 resurrect 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "FindOrCreateResurrect",
        email: "findorcreateresurrect@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const found = await SoftDeleteUser.findOrCreate(
        { email: "findorcreateresurrect@test.com" },
        { name: "Resurrected" },
        true, // resurrect
      );

      expect(found).toBeTruthy();
      expect(found.email).toBe("findorcreateresurrect@test.com");
      expect((found as any).deleted_at).toBeUndefined();
    });
  });

  describe("findOneAndUpdate", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该查找并更新记录", async () => {
      const user = await User.create({
        name: "FindOneAndUpdate",
        email: "findoneandupdate@test.com",
        age: 25,
      });

      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { name: "Updated", age: 30 },
        { returnDocument: "after" },
      );

      expect(updated).toBeTruthy();
      expect(updated?.name).toBe("Updated");
      expect(updated?.age).toBe(30);
    });
  });

  describe("findOneAndDelete", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该查找并删除记录", async () => {
      const user = await User.create({
        name: "FindOneAndDelete",
        email: "findoneanddelete@test.com",
        age: 25,
      });

      const deleted = await User.findOneAndDelete({ _id: user._id });

      expect(deleted).toBeTruthy();
      expect(deleted?._id?.toString()).toBe(user._id?.toString());

      const found = await User.findById(user._id);
      expect(found).toBeNull();
    });
  });

  describe("findOneAndReplace", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该查找并替换记录（返回最新记录）", async () => {
      const user = await User.create({
        name: "ReplaceTest",
        email: "replace@test.com",
        age: 25,
      });

      const replaced = await User.findOneAndReplace(
        { _id: user._id },
        { name: "Replaced", email: "replaced@test.com", age: 30 },
        true, // returnLatest
      );

      expect(replaced).toBeTruthy();
      expect(replaced?.name).toBe("Replaced");
      expect(replaced?.email).toBe("replaced@test.com");
      expect(replaced?.age).toBe(30);
    });

    it("应该查找并替换记录（返回替换前的记录）", async () => {
      const user = await User.create({
        name: "ReplaceBefore",
        email: "replacebefore@test.com",
        age: 25,
      });

      const before = await User.findOneAndReplace(
        { _id: user._id },
        { name: "Replaced", email: "replaced@test.com", age: 30 },
        false, // returnLatest = false
      );

      expect(before).toBeTruthy();
      expect(before?.name).toBe("ReplaceBefore");
      expect(before?.age).toBe(25);
    });
  });

  describe("truncate", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({ name: "Truncate1", email: "truncate1@test.com" });
      await User.create({ name: "Truncate2", email: "truncate2@test.com" });
    });

    it("应该清空表", async () => {
      const affected = await User.truncate();
      expect(affected).toBeGreaterThanOrEqual(0);

      const count = await User.count();
      expect(count).toBe(0);
    });
  });

  // ==================== 软删除相关方法 ====================

  describe("软删除相关方法", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_SOFT_DELETE);
    });

    it("应该支持软删除", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "Soft Delete",
        email: "softdelete@test.com",
      });

      const affected = await SoftDeleteUser.delete(user._id);
      expect(affected).toBe(1);

      const found = await SoftDeleteUser.find(user._id);
      expect(found).toBeNull();
    });

    it("应该支持 restore 恢复软删除记录", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "Restore",
        email: "restore@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const restored = await SoftDeleteUser.restore({ _id: user._id });
      expect(restored).toBeGreaterThan(0);

      const restoredUser = await SoftDeleteUser.find(user._id);
      expect(restoredUser).toBeTruthy();
    });

    it("应该支持 restoreById 通过 ID 恢复", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "RestoreById",
        email: "restorebyid@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const restored = await SoftDeleteUser.restoreById(user._id);
      expect(restored).toBe(1);

      const restoredUser = await SoftDeleteUser.find(user._id);
      expect(restoredUser).toBeTruthy();
    });

    it("应该支持 forceDelete 强制删除", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "ForceDelete",
        email: "forcedelete@test.com",
      });

      const affected = await SoftDeleteUser.forceDelete({ _id: user._id });
      expect(affected).toBeGreaterThan(0);

      const found = await SoftDeleteUser.find(user._id);
      expect(found).toBeNull();
    });

    it("应该支持 forceDeleteById 通过 ID 强制删除", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "ForceDeleteById",
        email: "forcedeletebyid@test.com",
      });

      const affected = await SoftDeleteUser.forceDeleteById(user._id);
      expect(affected).toBe(1);

      const found = await SoftDeleteUser.find(user._id);
      expect(found).toBeNull();
    });

    it("应该支持 withTrashed 包含已删除记录", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "User1",
        email: "user1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "User2",
        email: "user2@test.com",
      });

      await SoftDeleteUser.delete(user1._id);

      const allUsers = await SoftDeleteUser.withTrashed().findAll();
      expect(allUsers.length).toBe(2);

      const deletedUser = allUsers.find((u) =>
        u._id?.toString() === user1._id?.toString()
      );
      expect(deletedUser).toBeTruthy();
      expect((deletedUser as any).deleted_at).toBeTruthy();
    });

    it("应该支持 onlyTrashed 仅查询已删除记录", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "User1",
        email: "user1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "User2",
        email: "user2@test.com",
      });

      await SoftDeleteUser.delete(user1._id);

      const trashed = await SoftDeleteUser.onlyTrashed().findAll();
      expect(trashed.length).toBe(1);
      expect(trashed[0]._id?.toString()).toBe(user1._id?.toString());
    });
  });

  // ==================== 查询构建器 ====================

  describe("query 链式查询构建器", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      for (let i = 1; i <= 10; i++) {
        await User.create({
          name: `User${i}`,
          email: `user${i}@test.com`,
          age: 20 + i,
          status: i % 2 === 0 ? "active" : "inactive",
        });
      }
    });

    it("应该支持链式查询 findAll", async () => {
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
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // MongoDB 的查询构建器 update 方法使用 updateMany，应该更新所有匹配的记录
      const affected = await User.query()
        .where({ status: "active" })
        .update({ status: "updated" });

      expect(affected).toBeGreaterThanOrEqual(1);

      const updated = await User.findAll({ status: "updated" });
      expect(updated.length).toBeGreaterThanOrEqual(1);
    });

    it("应该支持链式查询 update 的 returnLatest 参数", async () => {
      const user = await User.create({
        name: "QueryUpdateReturnLatest",
        email: "queryupdatereturnlatest@test.com",
        age: 25,
      });

      const updated = await User.query()
        .where({ _id: user._id })
        .update({ name: "Updated", age: 30 }, true);

      expect(typeof updated).toBe("object");
      expect((updated as any).name).toBe("Updated");
      expect((updated as any).age).toBe(30);
    });

    it("应该支持链式查询 deleteMany", async () => {
      const affected = await User.query()
        .where({ status: "inactive" })
        .deleteMany();

      expect(affected).toBe(5);

      const remaining = await User.findAll();
      expect(remaining.length).toBe(5);
    });

    it("应该支持链式查询 deleteMany 的 options 参数", async () => {
      const user1 = await User.create({
        name: "QueryDeleteMany1",
        email: "querydeletemany1@test.com",
        age: 25,
      });
      const user2 = await User.create({
        name: "QueryDeleteMany2",
        email: "querydeletemany2@test.com",
        age: 25,
      });

      const result = await User.query()
        .where({ _id: { $in: [user1._id, user2._id] } })
        .deleteMany({ returnIds: true });

      if (typeof result === "object" && "count" in result) {
        expect(result.count).toBe(2);
      } else {
        throw new Error("Expected object with count");
      }
    });

    it("应该支持链式查询 increment", async () => {
      const user = await User.create({
        name: "Increment",
        email: "increment@test.com",
        age: 25,
      });

      const affected = await User.query()
        .where({ _id: user._id })
        .increment("age", 5);
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(30);
    });

    it("应该支持链式查询 increment 的 returnLatest 参数", async () => {
      const user = await User.create({
        name: "QueryIncrementReturnLatest",
        email: "queryincrementreturnlatest@test.com",
        age: 25,
      });

      const updated = await User.query()
        .where({ _id: user._id })
        .increment("age", 5, true);

      expect(typeof updated).toBe("object");
      expect((updated as any).age).toBe(30);
    });

    it("应该支持链式查询 decrement", async () => {
      const user = await User.create({
        name: "Decrement",
        email: "decrement@test.com",
        age: 30,
      });

      const affected = await User.query()
        .where({ _id: user._id })
        .decrement("age", 5);
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(25);
    });

    it("应该支持链式查询 decrement 的 returnLatest 参数", async () => {
      const user = await User.create({
        name: "QueryDecrementReturnLatest",
        email: "querydecrementreturnlatest@test.com",
        age: 30,
      });

      const updated = await User.query()
        .where({ _id: user._id })
        .decrement("age", 5, true);

      expect(typeof updated).toBe("object");
      expect((updated as any).age).toBe(25);
    });

    it("应该支持链式查询 incrementMany", async () => {
      // MongoDB 不需要 ALTER TABLE，字段会自动添加

      const user = await User.create({
        name: "QueryIncrementMany",
        email: "queryincrementmany@test.com",
        age: 25,
      });

      // 使用查询构建器 incrementMany（实现中存在，但类型定义可能未更新）
      const affected = await (User.query()
        .where({ _id: user._id }) as any)
        .incrementMany({ age: 5 });
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(30);
    });

    it("应该支持链式查询 decrementMany", async () => {
      const user = await User.create({
        name: "QueryDecrementMany",
        email: "querydecrementmany@test.com",
        age: 30,
      });

      // 使用查询构建器 decrementMany（实现中存在，但类型定义可能未更新）
      const affected = await (User.query()
        .where({ _id: user._id }) as any)
        .decrementMany({ age: 5 });
      expect(affected).toBe(1);

      const updated = await User.findById(user._id);
      expect(updated?.age).toBe(25);
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

      const updated = await User.query()
        .where({ email: "upsert@test.com" })
        .upsert(
          {
            name: "UpsertUpdated",
            email: "upsert@test.com",
            age: 26,
          },
          true,
          false,
        );
      expect(updated.name).toBe("UpsertUpdated");
      expect(updated.age).toBe(26);
    });

    it("应该支持链式查询 upsert 的 returnLatest 和 resurrect 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "QueryUpsertResurrect",
        email: "queryupsertresurrect@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const updated = await SoftDeleteUser.query()
        .where({ _id: user._id })
        .upsert(
          { name: "Resurrected" },
          true, // returnLatest
          true, // resurrect
        );

      expect(updated).toBeTruthy();
      expect(updated.name).toBe("Resurrected");
      expect((updated as any).deleted_at).toBeUndefined();
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

      const user2 = await User.query()
        .where({ email: "findorcreate@test.com" })
        .findOrCreate({
          name: "FindOrCreateNew",
          email: "findorcreate@test.com",
          age: 30,
        });
      expect(user2._id?.toString()).toBe(user1._id?.toString());
      expect(user2.name).toBe(user1.name);
    });

    it("应该支持链式查询 findOrCreate 的 resurrect 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "QueryFindOrCreateResurrect",
        email: "queryfindorcreateresurrect@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const found = await SoftDeleteUser.query()
        .where({ email: "queryfindorcreateresurrect@test.com" })
        .findOrCreate(
          { name: "Resurrected" },
          true, // resurrect
        );

      expect(found).toBeTruthy();
      expect(found.email).toBe("queryfindorcreateresurrect@test.com");
      expect((found as any).deleted_at).toBeUndefined();
    });

    it("应该支持链式查询 findOneAndUpdate", async () => {
      const user = await User.create({
        name: "FindOneAndUpdate",
        email: "findoneandupdate@test.com",
        age: 25,
      });

      // findOneAndUpdate 在查询构建器中接受 options 参数（实现中存在，但类型定义可能未更新）
      const updated = await (User.query()
        .where({ _id: user._id }) as any)
        .findOneAndUpdate(
          { name: "Updated", age: 30 },
          { returnDocument: "after" },
        );

      expect(updated).toBeTruthy();
      expect(updated?.name).toBe("Updated");
      expect(updated?.age).toBe(30);
    });

    it("应该支持链式查询 findOneAndDelete", async () => {
      const user = await User.create({
        name: "FindOneAndDelete",
        email: "findoneanddelete@test.com",
        age: 25,
      });

      const deleted = await User.query()
        .where({ _id: user._id })
        .findOneAndDelete();

      expect(deleted).toBeTruthy();
      expect(deleted?._id?.toString()).toBe(user._id?.toString());

      const found = await User.findById(user._id);
      expect(found).toBeNull();
    });

    it("应该支持链式查询 findOneAndReplace", async () => {
      const user = await User.create({
        name: "QueryFindOneAndReplace",
        email: "queryfindoneandreplace@test.com",
        age: 25,
      });

      // 使用查询构建器 findOneAndReplace（实现中存在，但类型定义可能未更新）
      const replaced = await (User.query()
        .where({ _id: user._id }) as any)
        .findOneAndReplace(
          { name: "Replaced", email: "replaced@test.com", age: 30 },
          true, // returnLatest
        );

      expect(replaced).toBeTruthy();
      expect(replaced?.name).toBe("Replaced");
      expect(replaced?.age).toBe(30);
    });

    it("应该支持链式查询 restoreById", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "QueryRestoreById",
        email: "queryrestorebyid@test.com",
      });

      await SoftDeleteUser.delete(user._id);

      const restored = await SoftDeleteUser.query()
        .restoreById(user._id);
      expect(restored).toBe(1);

      const found = await SoftDeleteUser.find(user._id);
      expect(found).toBeTruthy();
    });

    it("应该支持链式查询 forceDeleteById", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "QueryForceDeleteById",
        email: "queryforcedeletebyid@test.com",
      });

      const affected = await SoftDeleteUser.query()
        .forceDeleteById(user._id);
      expect(affected).toBe(1);

      const found = await SoftDeleteUser.find(user._id);
      expect(found).toBeNull();
    });

    it("应该支持链式查询 distinct", async () => {
      const ages = await User.query()
        .where({ status: "active" })
        .distinct("age");
      expect(ages.length).toBeGreaterThan(0);
      expect(Array.isArray(ages)).toBe(true);
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
    });

    it("应该支持链式查询 one (别名方法)", async () => {
      const user = await User.query()
        .where({ status: "active" })
        .sort({ age: "desc" })
        .one();

      expect(user).toBeTruthy();
      expect(user?.status).toBe("active");
    });

    it("应该支持链式查询 all (别名方法)", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .sort({ age: "desc" })
        .all();

      expect(users.length).toBe(5);
      expect(users[0].age).toBeGreaterThan(users[1].age);
    });

    it("应该支持链式查询 findById", async () => {
      const user = await User.create({
        name: "QueryFindById",
        email: "queryfindbyid@test.com",
        age: 25,
      });

      const found = await User.query()
        .findById(user._id);
      expect(found).toBeTruthy();
      expect(found?._id?.toString()).toBe(user._id?.toString());
      expect(found?.name).toBe("QueryFindById");
    });

    it("应该支持链式查询 findById 的 fields 参数", async () => {
      const user = await User.create({
        name: "QueryFindByIdFields",
        email: "queryfindbyidfields@test.com",
        age: 25,
      });

      const found = await User.query()
        .findById(user._id, ["name", "email"]);
      expect(found).toBeTruthy();
      expect(found?.name).toBe("QueryFindByIdFields");
      expect(found?.email).toBe("queryfindbyidfields@test.com");
    });

    it("应该支持链式查询 updateById", async () => {
      const user = await User.create({
        name: "QueryUpdateById",
        email: "queryupdatebyid@test.com",
        age: 25,
      });

      const affected = await User.query()
        .updateById(user._id, { name: "UpdatedById" });
      expect(affected).toBe(1);
    });

    // ==================== 新增查询方法测试 ====================

    describe("where, orWhere, andWhere 查询方法", () => {
      beforeEach(async () => {
        await clearCollection(COLLECTION_NAME);
        // 创建测试数据
        await User.create({ name: "Alice", email: "alice@test.com", age: 25, status: "active" });
        await User.create({ name: "Bob", email: "bob@test.com", age: 30, status: "active" });
        await User.create({ name: "Charlie", email: "charlie@test.com", age: 35, status: "inactive" });
        await User.create({ name: "David", email: "david@test.com", age: 20, status: "inactive" });
      });

      it("应该支持 where 方法进行基本查询", async () => {
        const users = await User.query()
          .where({ status: "active" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.status === "active")).toBe(true);
      });

      it("应该支持 where 方法使用字符串 ID 查询", async () => {
        const user = await User.create({
          name: "WhereStringId",
          email: "wherestringid@test.com",
          age: 25,
        });

        const found = await User.query()
          .where(user._id?.toString() || "")
          .findOne();

        expect(found).toBeTruthy();
        expect(found?._id?.toString()).toBe(user._id?.toString());
      });

      it("应该支持 where 方法使用复杂条件对象", async () => {
        const users = await User.query()
          .where({ age: { $gte: 30 } })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.age >= 30)).toBe(true);
      });

      it("应该支持 andWhere 方法添加 AND 条件", async () => {
        const users = await User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .findAll();

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Bob");
        expect(users[0].status).toBe("active");
        expect(users[0].age).toBeGreaterThanOrEqual(30);
      });

      it("应该支持多个 andWhere 方法链式调用", async () => {
        const users = await User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 25 } })
          .andWhere({ age: { $lte: 30 } })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.status === "active" && u.age >= 25 && u.age <= 30)).toBe(true);
      });

      it("应该支持 orWhere 方法添加 OR 条件", async () => {
        const users = await User.query()
          .where({ name: "Alice" })
          .orWhere({ name: "Charlie" })
          .findAll();

        expect(users.length).toBe(2);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Alice", "Charlie"]);
      });

      it("应该支持多个 orWhere 方法链式调用", async () => {
        const users = await User.query()
          .where({ name: "Alice" })
          .orWhere({ name: "Bob" })
          .orWhere({ name: "Charlie" })
          .findAll();

        expect(users.length).toBe(3);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Alice", "Bob", "Charlie"]);
      });

      it("应该支持 where、andWhere 和 orWhere 的组合使用", async () => {
        // 查询: (status = "active" AND age >= 30) OR (status = "inactive" AND age < 25)
        const users = await User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .orWhere({ status: "inactive" })
          .andWhere({ age: { $lt: 25 } })
          .findAll();

        // 应该找到 Bob (active, age=30) 和 David (inactive, age=20)
        expect(users.length).toBeGreaterThanOrEqual(1);
        const names = users.map(u => u.name);
        expect(names).toContain("Bob");
      });

      it("应该支持 where 重置所有条件", async () => {
        const builder = User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 30 } });

        // 重置条件
        const users = await builder
          .where({ status: "inactive" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every((u: any) => u.status === "inactive")).toBe(true);
      });

      it("应该支持嵌套 JSON 对象条件查询", async () => {
        await User.create({
          name: "NestedTest",
          email: "nested@test.com",
          age: 25,
          address: {
            city: "Beijing",
            country: "China",
          },
        });

        const users = await User.query()
          .where({ "address.city": "Beijing" })
          .findAll();

        expect(users.length).toBeGreaterThanOrEqual(1);
        expect(users.some(u => u.name === "NestedTest")).toBe(true);
      });

      it("应该支持 where 与其他查询方法组合使用", async () => {
        const count = await User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 25 } })
          .count();

        expect(count).toBe(2);

        const exists = await User.query()
          .where({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .exists();

        expect(exists).toBe(true);
      });
    });

    describe("like, orLike, andLike 查询方法", () => {
      beforeEach(async () => {
        await clearCollection(COLLECTION_NAME);
        // 创建测试数据
        await User.create({ name: "Alice", email: "alice@example.com", age: 25 });
        await User.create({ name: "Bob", email: "bob@test.com", age: 30 });
        await User.create({ name: "Charlie", email: "charlie@example.com", age: 35 });
        await User.create({ name: "David", email: "david@test.com", age: 20 });
        await User.create({ name: "Alice Smith", email: "alice.smith@test.com", age: 28 });
      });

      it("应该支持 like 方法进行模糊查询", async () => {
        const users = await User.query()
          .like({ name: "Alice" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.name.includes("Alice"))).toBe(true);
      });

      it("应该支持 like 方法使用对象形式参数", async () => {
        const users = await User.query()
          .like({ email: "example" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.email.includes("example"))).toBe(true);
      });

      it("应该支持 like 方法进行大小写不敏感查询", async () => {
        const users = await User.query()
          .like({ name: "alice" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.name.toLowerCase().includes("alice"))).toBe(true);
      });

      it("应该支持 andLike 方法添加 AND LIKE 条件", async () => {
        const users = await User.query()
          .where({ age: { $gte: 25 } })
          .andLike({ email: "example" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.email.includes("example") && u.age >= 25)).toBe(true);
      });

      it("应该支持多个 andLike 方法链式调用", async () => {
        const users = await User.query()
          .like({ name: "Alice" })
          .andLike({ email: "example" })
          .findAll();

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Alice");
        expect(users[0].email).toBe("alice@example.com");
      });

      it("应该支持 orLike 方法添加 OR LIKE 条件", async () => {
        const users = await User.query()
          .like({ name: "Bob" })
          .orLike({ name: "David" })
          .findAll();

        expect(users.length).toBe(2);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Bob", "David"]);
      });

      it("应该支持多个 orLike 方法链式调用", async () => {
        const users = await User.query()
          .like({ email: "alice" })
          .orLike({ email: "bob" })
          .orLike({ email: "charlie" })
          .findAll();

        // like({ email: "alice" }) 会匹配 alice@example.com 和 alice.smith@test.com
        // orLike({ email: "bob" }) 会匹配 bob@test.com
        // orLike({ email: "charlie" }) 会匹配 charlie@example.com
        // 所以总共 4 条记录
        expect(users.length).toBe(4);
        const emails = users.map(u => u.email).sort();
        expect(emails).toContain("alice@example.com");
        expect(emails).toContain("alice.smith@test.com");
        expect(emails).toContain("bob@test.com");
        expect(emails).toContain("charlie@example.com");
      });

      it("应该支持 like 与 where 方法组合使用", async () => {
        const users = await User.query()
          .where({ age: { $gte: 25 } })
          .like({ name: "Alice" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.name.includes("Alice") && u.age >= 25)).toBe(true);
      });

      it("应该支持 like 与 andWhere 方法组合使用", async () => {
        const users = await User.query()
          .like({ email: "example" })
          .andWhere({ age: { $gte: 30 } })
          .findAll();

        expect(users.length).toBe(1);
        expect(users[0].email).toBe("charlie@example.com");
        expect(users[0].age).toBeGreaterThanOrEqual(30);
      });

      it("应该支持 like 与 orWhere 方法组合使用", async () => {
        const users = await User.query()
          .where({ name: "Bob" })
          .orWhere({ name: "David" })
          .orLike({ email: "alice" })
          .findAll();

        expect(users.length).toBeGreaterThanOrEqual(2);
        const names = users.map(u => u.name);
        expect(names).toContain("Bob");
      });

      it("应该支持嵌套 JSON 对象 like 查询", async () => {
        await User.create({
          name: "NestedLike",
          email: "nestedlike@test.com",
          age: 25,
          profile: {
            bio: "Software developer",
            company: "Tech Corp",
          },
        });

        const users = await User.query()
          .like({ "profile.bio": "developer" })
          .findAll();

        expect(users.length).toBeGreaterThanOrEqual(1);
        expect(users.some(u => u.name === "NestedLike")).toBe(true);
      });

      it("应该支持 like 方法保留现有操作符对象", async () => {
        // like 方法应该能够处理已经包含 $regex 的对象
        const users = await User.query()
          .like({ name: { $regex: "Alice", $options: "i" } })
          .findAll();

        expect(users.length).toBeGreaterThanOrEqual(1);
      });

      it("应该支持 like 方法与其他查询方法组合使用", async () => {
        const count = await User.query()
          .like({ email: "example" })
          .andWhere({ age: { $gte: 25 } })
          .count();

        expect(count).toBe(2);

        const exists = await User.query()
          .like({ name: "Alice" })
          .exists();

        expect(exists).toBe(true);
      });

      it("应该支持 like 方法在 update 中使用", async () => {
        const affected = await User.query()
          .like({ email: "example" })
          .update({ status: "updated" });

        expect(affected).toBeGreaterThanOrEqual(1);

        const updated = await User.findAll({ status: "updated" });
        expect(updated.length).toBeGreaterThanOrEqual(1);
      });

      it("应该支持 like 方法在 deleteMany 中使用", async () => {
        const beforeCount = await User.query()
          .like({ email: "test" })
          .count();

        expect(beforeCount).toBeGreaterThanOrEqual(1);

        const affected = await User.query()
          .like({ email: "test" })
          .deleteMany();

        expect(affected).toBeGreaterThanOrEqual(1);

        const afterCount = await User.query()
          .like({ email: "test" })
          .count();

        expect(afterCount).toBe(0);
      });
    });

    // ==================== find() 方法的查询条件测试 ====================

    describe("find() 方法的 orWhere, andWhere 查询", () => {
      beforeEach(async () => {
        await clearCollection(COLLECTION_NAME);
        // 创建测试数据
        await User.create({ name: "Alice", email: "alice@test.com", age: 25, status: "active" });
        await User.create({ name: "Bob", email: "bob@test.com", age: 30, status: "active" });
        await User.create({ name: "Charlie", email: "charlie@test.com", age: 35, status: "inactive" });
        await User.create({ name: "David", email: "david@test.com", age: 20, status: "inactive" });
      });

      it("应该支持 find().andWhere() 方法添加 AND 条件", async () => {
        const users = await User.find({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .findAll();

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Bob");
        expect(users[0].status).toBe("active");
        expect(users[0].age).toBeGreaterThanOrEqual(30);
      });

      it("应该支持 find() 多个 andWhere 方法链式调用", async () => {
        const users = await User.find({ status: "active" })
          .andWhere({ age: { $gte: 25 } })
          .andWhere({ age: { $lte: 30 } })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.status === "active" && u.age >= 25 && u.age <= 30)).toBe(true);
      });

      it("应该支持 find().orWhere() 方法添加 OR 条件", async () => {
        const users = await User.find({ name: "Alice" })
          .orWhere({ name: "Charlie" })
          .findAll();

        expect(users.length).toBe(2);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Alice", "Charlie"]);
      });

      it("应该支持 find() 多个 orWhere 方法链式调用", async () => {
        const users = await User.find({ name: "Alice" })
          .orWhere({ name: "Bob" })
          .orWhere({ name: "Charlie" })
          .findAll();

        expect(users.length).toBe(3);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Alice", "Bob", "Charlie"]);
      });

      it("应该支持 find() andWhere 和 orWhere 的组合使用", async () => {
        // 查询: (status = "active" AND age >= 30) OR (status = "inactive" AND age < 25)
        const users = await User.find({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .orWhere({ status: "inactive" })
          .andWhere({ age: { $lt: 25 } })
          .findAll();

        // 应该找到 Bob (active, age=30) 和 David (inactive, age=20)
        expect(users.length).toBeGreaterThanOrEqual(1);
        const names = users.map(u => u.name);
        expect(names).toContain("Bob");
      });

      it("应该支持 find() 与其他查询方法组合使用", async () => {
        const count = await User.find({ status: "active" })
          .andWhere({ age: { $gte: 25 } })
          .count();

        expect(count).toBe(2);

        const exists = await User.find({ status: "active" })
          .andWhere({ age: { $gte: 30 } })
          .exists();

        expect(exists).toBe(true);
      });
    });

    describe("find() 方法的 orLike, andLike 查询", () => {
      beforeEach(async () => {
        await clearCollection(COLLECTION_NAME);
        // 创建测试数据
        await User.create({ name: "Alice", email: "alice@example.com", age: 25 });
        await User.create({ name: "Bob", email: "bob@test.com", age: 30 });
        await User.create({ name: "Charlie", email: "charlie@example.com", age: 35 });
        await User.create({ name: "David", email: "david@test.com", age: 20 });
        await User.create({ name: "Alice Smith", email: "alice.smith@test.com", age: 28 });
      });

      it("应该支持 find().andLike() 方法添加 AND LIKE 条件", async () => {
        const users = await User.find({ age: { $gte: 25 } })
          .andLike({ email: "example" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.email.includes("example") && u.age >= 25)).toBe(true);
      });

      it("应该支持 find() 多个 andLike 方法链式调用", async () => {
        const users = await User.find({ name: { $regex: "Alice", $options: "i" } })
          .andLike({ email: "example" })
          .findAll();

        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Alice");
        expect(users[0].email).toBe("alice@example.com");
      });

      it("应该支持 find().orLike() 方法添加 OR LIKE 条件", async () => {
        const users = await User.find({ name: { $regex: "Bob", $options: "i" } })
          .orLike({ name: "David" })
          .findAll();

        expect(users.length).toBe(2);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Bob", "David"]);
      });

      it("应该支持 find() 多个 orLike 方法链式调用", async () => {
        const users = await User.find({ email: { $regex: "alice", $options: "i" } })
          .orLike({ email: "bob" })
          .orLike({ email: "charlie" })
          .findAll();

        expect(users.length).toBe(4);
        const emails = users.map(u => u.email).sort();
        expect(emails).toContain("alice@example.com");
        expect(emails).toContain("bob@test.com");
        expect(emails).toContain("charlie@example.com");
      });

      it("应该支持 find() andLike 与 andWhere 方法组合使用", async () => {
        const users = await User.find({ age: { $gte: 25 } })
          .andLike({ name: "Alice" })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.name.includes("Alice") && u.age >= 25)).toBe(true);
      });

      it("应该支持 find() andLike 与 andWhere 方法组合使用", async () => {
        const users = await User.find({ name: { $regex: "Alice", $options: "i" } })
          .andWhere({ age: { $gte: 25 } })
          .findAll();

        expect(users.length).toBe(2);
        expect(users.every(u => u.name.includes("Alice") && u.age >= 25)).toBe(true);
      });

      it("应该支持 find() orLike 与 orWhere 方法组合使用", async () => {
        const users = await User.find({ name: { $regex: "Bob", $options: "i" } })
          .orWhere({ name: "David" })
          .findAll();

        expect(users.length).toBe(2);
        const names = users.map(u => u.name).sort();
        expect(names).toEqual(["Bob", "David"]);
      });

      it("应该支持 find() andLike 方法与其他查询方法组合使用", async () => {
        const count = await User.find({ email: { $regex: "example", $options: "i" } })
          .andWhere({ age: { $gte: 25 } })
          .count();

        expect(count).toBe(2);

        const exists = await User.find({ name: { $regex: "Alice", $options: "i" } })
          .exists();

        expect(exists).toBe(true);
      });
    });

    it("应该支持链式查询 updateMany", async () => {
      const affected = await User.query()
        .where({ status: "active" })
        .updateMany({ status: "updated_many" });

      expect(affected).toBe(5);

      const updated = await User.findAll({ status: "updated_many" });
      expect(updated.length).toBe(5);
    });

    it("应该支持链式查询 deleteById", async () => {
      const user = await User.create({
        name: "QueryDeleteById",
        email: "querydeletebyid@test.com",
        age: 25,
      });

      const affected = await User.query()
        .deleteById(user._id);
      expect(affected).toBe(1);

      const found = await User.findById(user._id);
      expect(found).toBeNull();
    });

    it("应该支持链式查询 restore", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "QueryRestore1",
        email: "queryrestore1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "QueryRestore2",
        email: "queryrestore2@test.com",
      });

      await SoftDeleteUser.delete(user1._id);
      await SoftDeleteUser.delete(user2.id);

      const restored = await SoftDeleteUser.query()
        .where({ id: { $in: [user1.id, user2.id] } })
        .restore();
      expect(typeof restored === "number" ? restored : restored.count)
        .toBeGreaterThanOrEqual(2);

      const found1 = await SoftDeleteUser.find(user1._id);
      const found2 = await SoftDeleteUser.find(user2._id);
      expect(found1).toBeTruthy();
      expect(found2).toBeTruthy();
    });

    it("应该支持链式查询 restore 的 options 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "QueryRestoreOptions1",
        email: "queryrestoreoptions1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "QueryRestoreOptions2",
        email: "queryrestoreoptions2@test.com",
      });

      await SoftDeleteUser.delete(user1._id);
      await SoftDeleteUser.delete(user2.id);

      const result = await SoftDeleteUser.query()
        .where({ id: { $in: [user1.id, user2.id] } })
        .restore({ returnIds: true });

      if (typeof result === "object" && "count" in result) {
        expect(result.count).toBeGreaterThanOrEqual(2);
        expect(result.ids.length).toBeGreaterThanOrEqual(2);
      } else {
        throw new Error("Expected object with count and ids");
      }
    });

    it("应该支持链式查询 forceDelete", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "QueryForceDelete1",
        email: "queryforcedelete1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "QueryForceDelete2",
        email: "queryforcedelete2@test.com",
      });

      const result = await SoftDeleteUser.query()
        .where({ id: { $in: [user1.id, user2.id] } })
        .forceDelete();
      expect(typeof result === "number" ? result : result.count)
        .toBeGreaterThanOrEqual(2);

      const found1 = await SoftDeleteUser.find(user1._id);
      const found2 = await SoftDeleteUser.find(user2._id);
      expect(found1).toBeNull();
      expect(found2).toBeNull();
    });

    it("应该支持链式查询 forceDelete 的 options 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      const user1 = await SoftDeleteUser.create({
        name: "QueryForceDeleteOptions1",
        email: "queryforcedeleteoptions1@test.com",
      });
      const user2 = await SoftDeleteUser.create({
        name: "QueryForceDeleteOptions2",
        email: "queryforcedeleteoptions2@test.com",
      });

      const result = await SoftDeleteUser.query()
        .where({ id: { $in: [user1.id, user2.id] } })
        .forceDelete({ returnIds: true });

      if (typeof result === "object" && "count" in result) {
        expect(result.count).toBeGreaterThanOrEqual(2);
        expect(result.ids.length).toBeGreaterThanOrEqual(2);
      } else {
        throw new Error("Expected object with count and ids");
      }
    });
  });

  // ==================== asArray 方法测试 ====================

  describe("asArray 方法 - 返回纯 JSON 对象数组", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      for (let i = 1; i <= 10; i++) {
        await User.create({
          name: `AsArrayUser${i}`,
          email: `asarrayuser${i}@test.com`,
          age: 20 + i,
          status: i % 2 === 0 ? "active" : "inactive",
        });
      }
    });

    it("应该通过 find().asArray().findAll() 返回纯 JSON 对象数组", async () => {
      const users = await User.find({ status: "active" })
        .asArray()
        .findAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      // 验证返回的是纯 JSON 对象，不是模型实例
      const user = users[0];
      expect(user).toBeTruthy();
      expect(user.constructor.name).not.toBe("User");
      expect(typeof user).toBe("object");
      expect(user.name).toBeTruthy();
      expect(user.email).toBeTruthy();
      // 验证没有模型方法（如果有的话）
      expect(typeof (user as any).save).toBe("undefined");
    });

    it("应该通过 find().asArray().findOne() 返回纯 JSON 对象或 null", async () => {
      const user = await User.find({ status: "active" })
        .asArray()
        .findOne();

      expect(user).toBeTruthy();
      if (user) {
        expect(user.constructor.name).not.toBe("User");
        expect(typeof user).toBe("object");
        expect(user.name).toBeTruthy();
        expect(user.email).toBeTruthy();
        // 验证没有模型方法
        expect(typeof (user as any).save).toBe("undefined");
      }
    });

    it("应该通过 query().where().asArray().findAll() 返回纯 JSON 对象数组", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .findAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(5);

      // 验证返回的是纯 JSON 对象
      users.forEach((user) => {
        expect(user.constructor.name).not.toBe("User");
        expect(typeof user).toBe("object");
        expect(user.status).toBe("active");
        expect(typeof (user as any).save).toBe("undefined");
      });
    });

    it("应该通过 query().where().asArray().findOne() 返回纯 JSON 对象或 null", async () => {
      const user = await User.query()
        .where({ status: "active" })
        .asArray()
        .findOne();

      expect(user).toBeTruthy();
      if (user) {
        expect(user.constructor.name).not.toBe("User");
        expect(typeof user).toBe("object");
        expect(user.status).toBe("active");
        expect(typeof (user as any).save).toBe("undefined");
      }
    });

    it("应该支持 asArray() 链式调用 sort", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .sort({ age: "desc" })
        .findAll();

      expect(users.length).toBe(5);
      // 验证排序
      for (let i = 1; i < users.length; i++) {
        expect(users[i - 1].age).toBeGreaterThanOrEqual(users[i].age);
      }
      // 验证是纯 JSON 对象
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该支持 asArray() 链式调用 limit", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .limit(2)
        .findAll();

      expect(users.length).toBe(2);
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该支持 asArray() 链式调用 skip", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .skip(2)
        .limit(2)
        .findAll();

      expect(users.length).toBe(2);
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该支持 asArray() 链式调用 fields", async () => {
      const user = await User.query()
        .where({ status: "active" })
        .asArray()
        .fields(["name", "age"])
        .findOne();

      expect(user).toBeTruthy();
      if (user) {
        expect(user.name).toBeTruthy();
        expect(user.age).toBeTruthy();
        // email 字段可能不存在（因为 fields 限制）
        expect(user.constructor.name).not.toBe("User");
      }
    });

    it("应该支持 asArray().count()", async () => {
      const count = await User.query()
        .where({ status: "active" })
        .asArray()
        .count();

      expect(count).toBe(5);
    });

    it("应该支持 asArray().exists()", async () => {
      const exists = await User.query()
        .where({ status: "active" })
        .asArray()
        .exists();

      expect(exists).toBe(true);
    });

    it("应该支持 asArray().distinct()", async () => {
      const ages = await User.query()
        .where({ status: "active" })
        .asArray()
        .distinct("age");

      expect(Array.isArray(ages)).toBe(true);
      expect(ages.length).toBeGreaterThan(0);
    });

    it("应该支持 asArray().paginate()", async () => {
      const result = await User.query()
        .where({ status: "active" })
        .asArray()
        .paginate(1, 2);

      expect(result.data).toBeTruthy();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(3);

      // 验证返回的数据是纯 JSON 对象
      result.data.forEach((user) => {
        expect(user.constructor.name).not.toBe("User");
        expect(typeof (user as any).save).toBe("undefined");
      });
    });

    it("应该支持 find().asArray().all()", async () => {
      const users = await User.find({ status: "active" })
        .asArray()
        .all();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(5);
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该支持 find().asArray().one()", async () => {
      const user = await User.find({ status: "active" })
        .asArray()
        .one();

      expect(user).toBeTruthy();
      if (user) {
        expect(user.constructor.name).not.toBe("User");
      }
    });

    it("应该支持 query().asArray().all()", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .all();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(5);
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该支持 query().asArray().one()", async () => {
      const user = await User.query()
        .where({ status: "active" })
        .asArray()
        .one();

      expect(user).toBeTruthy();
      if (user) {
        expect(user.constructor.name).not.toBe("User");
      }
    });

    it("应该支持 query().asArray() 不通过 where 直接使用", async () => {
      const users = await User.query()
        .asArray()
        .limit(3)
        .findAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(3);
      expect(users[0].constructor.name).not.toBe("User");
    });

    it("应该在查询结果为空时返回空数组", async () => {
      const users = await User.find({ status: "nonexistent" })
        .asArray()
        .findAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    });

    it("应该在查询结果为空时返回 null (findOne)", async () => {
      const user = await User.find({ status: "nonexistent" })
        .asArray()
        .findOne();

      expect(user).toBeNull();
    });

    it("应该支持复杂的链式调用", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .sort({ age: "desc" })
        .skip(1)
        .limit(2)
        .findAll();

      expect(users.length).toBe(2);
      expect(users[0].constructor.name).not.toBe("User");
      // 验证排序
      expect(users[0].age).toBeGreaterThanOrEqual(users[1].age);
    });

    it("应该验证返回的对象可以 JSON 序列化", async () => {
      const users = await User.query()
        .where({ status: "active" })
        .asArray()
        .findAll();

      // 验证可以 JSON 序列化（纯对象应该可以）
      const json = JSON.stringify(users);
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(users.length);
    });
  });

  // ==================== 作用域 ====================

  describe("scope", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await User.create({
        name: "Active User",
        email: "active@test.com",
        age: 25,
        status: "active",
      });
      await User.create({
        name: "Inactive User",
        email: "inactive@test.com",
        age: 30,
        status: "inactive",
      });
    });

    it("应该支持作用域查询", async () => {
      class ScopedUser extends MongoModel {
        static override collectionName = COLLECTION_NAME;
        static override scopes = {
          active: () => ({ status: "active" }),
          older: () => ({ age: { $gt: 25 } }),
        };
      }
      ScopedUser.setAdapter(adapter);

      const activeUsers = await ScopedUser.scope("active").findAll();
      expect(activeUsers.length).toBe(1);
      expect(activeUsers[0].status).toBe("active");
    });
  });

  // ==================== 实例方法 ====================

  describe("实例方法", () => {
    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
    });

    it("应该支持 save 保存新实例", async () => {
      const user = new User();
      user.name = "Save";
      user.email = "save@test.com";
      user.age = 25;

      const saved = await user.save();
      expect(saved._id).toBeTruthy();
      expect(saved.name).toBe("Save");
    });

    it("应该支持 save 更新现有实例", async () => {
      const created = await User.create({
        name: "Original",
        email: "original@test.com",
        age: 25,
      });

      created.name = "Updated";
      const saved = await created.save();

      expect(saved.name).toBe("Updated");
      const found = await User.find(created._id);
      expect(found?.name).toBe("Updated");
    });

    it("应该支持实例方法 update", async () => {
      const user = await User.create({
        name: "Update Instance",
        email: "updateinstance@test.com",
        age: 25,
      });

      const updated = await user.update({ age: 26 });
      expect(updated.age).toBe(26);
    });

    it("应该支持实例方法 delete", async () => {
      const user = await User.create({
        name: "Delete Instance",
        email: "deleteinstance@test.com",
        age: 25,
      });

      const deleted = await user.delete();
      expect(deleted).toBe(true);

      const found = await User.find(user._id);
      expect(found).toBeNull();
    });
  });

  // ==================== 关联方法 ====================

  describe("关联方法", () => {
    const TABLE_POSTS = "mysql_model_posts";
    const TABLE_PROFILES = "mysql_model_profiles";

    beforeAll(async () => {
      // MongoDB 不需要创建表，集合会在首次插入时自动创建
      // 清理现有数据
      const db = (adapter as any)?.getDatabase();
      if (db) {
        await db.collection(COLLECTION_POSTS).deleteMany({});
        await db.collection(COLLECTION_PROFILES).deleteMany({});
      }
    });

    beforeEach(async () => {
      await clearCollection(COLLECTION_NAME);
      await clearCollection(COLLECTION_POSTS);
      await clearCollection(COLLECTION_PROFILES);
    });

    it("应该支持 belongsTo 关联查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await User.create({
        name: "BelongsTo User",
        email: "belongsto@test.com",
        age: 25,
      });

      const post = await Post.create({
        user_id: user._id,
        title: "Test Post",
        content: "Test Content",
      });

      const relatedUser = await post.belongsTo(User, "user_id", "_id");
      expect(relatedUser).toBeTruthy();
      expect(relatedUser?._id?.toString()).toBe(user._id?.toString());
      expect(relatedUser?.name).toBe("BelongsTo User");
    });

    it("应该支持 belongsTo 的 fields 参数", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await User.create({
        name: "BelongsTo Fields User",
        email: "belongstofields@test.com",
        age: 25,
      });

      const post = await Post.create({
        user_id: user._id,
        title: "Test Post",
        content: "Test Content",
      });

      const relatedUser = await post.belongsTo(
        User,
        "user_id",
        "_id",
        ["name", "email"],
      );
      expect(relatedUser).toBeTruthy();
      expect(relatedUser?.name).toBe("BelongsTo Fields User");
      expect(relatedUser?.email).toBe("belongstofields@test.com");
    });

    it("应该支持 belongsTo 的 includeTrashed 参数", async () => {
      class SoftDeleteUser extends MongoModel {
        static override collectionName = COLLECTION_SOFT_DELETE;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteUser.setAdapter(adapter);

      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await SoftDeleteUser.create({
        name: "BelongsTo IncludeTrashed",
        email: "belongstoincludetrashed@test.com",
      });

      const post = await Post.create({
        user_id: user._id,
        title: "Test Post",
        content: "Test Content",
      });

      await SoftDeleteUser.delete(user._id);

      // 默认不包含软删除记录
      const relatedUser1 = await post.belongsTo(
        SoftDeleteUser,
        "user_id",
        "id",
      );
      expect(relatedUser1).toBeNull();

      // 包含软删除记录
      const relatedUser2 = await post.belongsTo(
        SoftDeleteUser,
        "user_id",
        "_id",
        undefined,
        true, // includeTrashed
      );
      expect(relatedUser2).toBeTruthy();
      expect(relatedUser2?._id?.toString()).toBe(user._id?.toString());
    });

    it("应该支持 hasOne 关联查询", async () => {
      class Profile extends MongoModel {
        static override collectionName = COLLECTION_PROFILES;
        static override primaryKey = "_id";
      }
      Profile.setAdapter(adapter);

      const user = await User.create({
        name: "HasOne User",
        email: "hason@test.com",
        age: 25,
      });

      const profile = await Profile.create({
        user_id: user._id,
        bio: "Test Bio",
      });

      const relatedProfile = await user.hasOne(Profile, "user_id", "_id");
      expect(relatedProfile).toBeTruthy();
      expect(relatedProfile?._id?.toString()).toBe(profile._id?.toString());
      expect(relatedProfile?.bio).toBe("Test Bio");
    });

    it("应该支持 hasOne 的 fields 参数", async () => {
      class Profile extends MongoModel {
        static override collectionName = COLLECTION_PROFILES;
        static override primaryKey = "_id";
      }
      Profile.setAdapter(adapter);

      const user = await User.create({
        name: "HasOne Fields User",
        email: "hasonfields@test.com",
        age: 25,
      });

      await Profile.create({
        user_id: user._id,
        bio: "Test Bio",
      });

      const relatedProfile = await user.hasOne(
        Profile,
        "user_id",
        "_id",
        ["bio"],
      );
      expect(relatedProfile).toBeTruthy();
      expect(relatedProfile?.bio).toBe("Test Bio");
    });

    it("应该支持 hasOne 的 includeTrashed 参数", async () => {
      class SoftDeleteProfile extends MongoModel {
        static override collectionName = COLLECTION_PROFILES;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeleteProfile.setAdapter(adapter);

      const user = await User.create({
        name: "HasOne IncludeTrashed",
        email: "hasonincludetrashed@test.com",
        age: 25,
      });

      const profile = await SoftDeleteProfile.create({
        user_id: user._id,
        bio: "Test Bio",
      });

      await SoftDeleteProfile.delete(profile._id);

      // 默认不包含软删除记录
      const relatedProfile1 = await user.hasOne(
        SoftDeleteProfile,
        "user_id",
        "_id",
      );
      expect(relatedProfile1).toBeNull();

      // 包含软删除记录
      const relatedProfile2 = await user.hasOne(
        SoftDeleteProfile,
        "user_id",
        "_id",
        undefined,
        true, // includeTrashed
      );
      expect(relatedProfile2).toBeTruthy();
      expect(relatedProfile2?._id?.toString()).toBe(profile._id?.toString());
    });

    it("应该支持 hasMany 关联查询", async () => {
      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await User.create({
        name: "HasMany User",
        email: "hasmany@test.com",
        age: 25,
      });

      await Post.create({
        user_id: user._id,
        title: "Post 1",
        content: "Content 1",
      });
      await Post.create({
        user_id: user._id,
        title: "Post 2",
        content: "Content 2",
      });

      const posts = await user.hasMany(Post, "user_id", "_id");
      expect(posts.length).toBe(2);
      expect(posts[0].title).toBeTruthy();
      expect(posts[1].title).toBeTruthy();
    });

    it("应该支持 hasMany 的 fields 参数", async () => {
      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await User.create({
        name: "HasMany Fields User",
        email: "hasmanyfields@test.com",
        age: 25,
      });

      await Post.create({
        user_id: user._id,
        title: "Post 1",
        content: "Content 1",
      });

      const posts = await user.hasMany(Post, "user_id", "_id", ["title"]);
      expect(posts.length).toBe(1);
      expect(posts[0].title).toBe("Post 1");
    });

    it("应该支持 hasMany 的 options 参数", async () => {
      class Post extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override primaryKey = "_id";
      }
      Post.setAdapter(adapter);

      const user = await User.create({
        name: "HasMany Options User",
        email: "hasmanyoptions@test.com",
        age: 25,
      });

      await Post.create({
        user_id: user._id,
        title: "Post 1",
        content: "Content 1",
      });
      await Post.create({
        user_id: user._id,
        title: "Post 2",
        content: "Content 2",
      });
      await Post.create({
        user_id: user._id,
        title: "Post 3",
        content: "Content 3",
      });

      const posts = await user.hasMany(Post, "user_id", "_id", undefined, {
        sort: { _id: "desc" },
        limit: 2,
      });
      expect(posts.length).toBe(2);
      expect(posts[0]._id?.toString()).not.toBe(posts[1]._id?.toString());
    });

    it("应该支持 hasMany 的 includeTrashed 参数", async () => {
      class SoftDeletePost extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeletePost.setAdapter(adapter);

      const user = await User.create({
        name: "HasMany IncludeTrashed",
        email: "hasmanyincludetrashed@test.com",
        age: 25,
      });

      const post1 = await SoftDeletePost.create({
        user_id: user._id,
        title: "Post 1",
        content: "Content 1",
      });
      const post2 = await SoftDeletePost.create({
        user_id: user._id,
        title: "Post 2",
        content: "Content 2",
      });

      await SoftDeletePost.delete(post1._id);

      // 默认不包含软删除记录
      const posts1 = await user.hasMany(SoftDeletePost, "user_id", "_id");
      expect(posts1.length).toBe(1);
      expect(posts1[0]._id?.toString()).toBe(post2._id?.toString());

      // 包含软删除记录
      const posts2 = await user.hasMany(
        SoftDeletePost,
        "user_id",
        "_id",
        undefined,
        undefined,
        true, // includeTrashed
      );
      expect(posts2.length).toBe(2);
    });

    it("应该支持 hasMany 的 onlyTrashed 参数", async () => {
      class SoftDeletePost extends MongoModel {
        static override collectionName = COLLECTION_POSTS;
        static override softDelete = true;
        static override deletedAtField = "deleted_at";
      }
      SoftDeletePost.setAdapter(adapter);

      const user = await User.create({
        name: "HasMany OnlyTrashed",
        email: "hasmanyonlytrashed@test.com",
        age: 25,
      });

      const post1 = await SoftDeletePost.create({
        user_id: user._id,
        title: "Post 1",
        content: "Content 1",
      });
      const post2 = await SoftDeletePost.create({
        user_id: user._id,
        title: "Post 2",
        content: "Content 2",
      });

      await SoftDeletePost.delete(post1._id);

      // 仅查询软删除记录
      const posts = await user.hasMany(
        SoftDeletePost,
        "user_id",
        "_id",
        undefined,
        undefined,
        false, // includeTrashed
        true, // onlyTrashed
      );
      expect(posts.length).toBe(1);
      expect(posts[0]._id?.toString()).toBe(post1._id?.toString());
    });
  });
}, {
  // MongoDB 客户端库可能有内部定时器和资源，禁用泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
