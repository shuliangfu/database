/**
 * @fileoverview MongoModel 缓存机制测试（共用用例见 tests/shared/cases/cache.ts）
 */

import { MemoryAdapter } from "@dreamer/cache";
import { expect, it } from "@dreamer/test";
import { mongoFixture } from "../shared/fixture.ts";
import { registerCacheTests } from "../shared/cases/cache.ts";

registerCacheTests(mongoFixture, {
  connectOverrides: { database: "test_mongo_cache" },
  extras: ({ User }) => {
    it("应该在批量创建后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 查询所有用户（应该缓存空结果）
      const users1 = await User.findAll();
      expect(users1.length).toBe(0);

      // 批量创建用户（注意：createMany 目前没有清除缓存，但应该清除）
      await User.createMany([
        { name: "User 1", email: "user1@test.com", age: 25 },
        { name: "User 2", email: "user2@test.com", age: 30 },
      ]);

      // 再次查询所有用户（应该查询数据库，因为缓存已被清除）
      // 注意：如果 createMany 没有清除缓存，这个测试可能会失败
      const users2 = await User.findAll();
      expect(users2.length).toBe(2);
    });

    it("应该在批量更新后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user1 = await User.create({
        name: "User 1",
        email: "user1@test.com",
        age: 25,
      });
      const user2 = await User.create({
        name: "User 2",
        email: "user2@test.com",
        age: 30,
      });

      // 第一次查询（应该查询数据库并缓存）
      const users1 = await User.findAll({ age: 25 });
      expect(users1.length).toBe(1);

      // 批量更新（注意：不能更新 _id 字段）
      await User.updateMany({ age: 25 }, { age: 26 });

      // 再次查询（应该查询数据库，因为缓存已被清除）
      // 注意：如果 updateMany 没有清除缓存，这个测试可能会失败
      const users2 = await User.findAll({ age: 26 });
      expect(users2.length).toBe(1);
    });

    it("应该在批量删除后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      await User.create({
        name: "User 1",
        email: "user1@test.com",
        age: 25,
      });
      await User.create({
        name: "User 2",
        email: "user2@test.com",
        age: 30,
      });

      // 第一次查询（应该查询数据库并缓存）
      const users1 = await User.findAll();
      expect(users1.length).toBe(2);

      // 批量删除（注意：deleteMany 目前没有清除缓存，但应该清除）
      await User.deleteMany({ age: 25 });

      // 再次查询（应该查询数据库，因为缓存已被清除）
      // 注意：如果 deleteMany 没有清除缓存，这个测试可能会失败
      const users2 = await User.findAll();
      expect(users2.length).toBe(1);
    });

    it("应该在自增字段后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.age).toBe(25);

      // 自增字段
      await User.increment(user._id, "age", 5);

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2?.age).toBe(30);
    });

    it("应该在自减字段后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 30,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.age).toBe(30);

      // 自减字段
      await User.decrement(user._id, "age", 5);

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2?.age).toBe(25);
    });

    it("应该在软删除后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;
      User.softDelete = true;
      User.deletedAtField = "deletedAt";

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1).toBeTruthy();

      // 软删除
      await User.delete(user._id);

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2).toBeNull();
    });

    it("应该在恢复软删除后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;
      User.softDelete = true;
      User.deletedAtField = "deletedAt";

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 软删除
      await User.delete(user._id);

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1).toBeNull();

      // 恢复
      await User.restore(user._id);

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2).toBeTruthy();
    });

    it("应该在强制删除后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1).toBeTruthy();

      // 强制删除
      await User.forceDelete(user._id);

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2).toBeNull();
    });

    it("应该在 findOneAndUpdate 后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.name).toBe("Test User");

      // 使用 findOneAndUpdate（注意：findOneAndUpdate 目前没有清除缓存，但应该清除）
      await User.findOneAndUpdate(
        { _id: user._id },
        { name: "Updated" },
      );

      // 再次查询（应该查询数据库，因为缓存已被清除）
      // 注意：如果 findOneAndUpdate 没有清除缓存，这个测试可能会失败
      const user2 = await User.find(user._id);
      expect(user2?.name).toBe("Updated");
    });

    it("应该在 findOneAndDelete 后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1).toBeTruthy();

      // 使用 findOneAndDelete（注意：findOneAndDelete 目前没有清除缓存，但应该清除）
      await User.findOneAndDelete({ _id: user._id });

      // 再次查询（应该查询数据库，因为缓存已被清除）
      // 注意：如果 findOneAndDelete 没有清除缓存，这个测试可能会失败
      const user2 = await User.find(user._id);
      expect(user2).toBeNull();
    });

    it("应该在 findOneAndReplace 后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 创建测试数据
      const user = await User.create({
        name: "Test User",
        email: "test@test.com",
        age: 25,
      });

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.name).toBe("Test User");

      // 使用 findOneAndReplace
      await User.findOneAndReplace(
        { _id: user._id },
        { name: "Replaced", email: "replaced@test.com", age: 30 },
      );

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2?.name).toBe("Replaced");
      expect(user2?.age).toBe(30);
    });

    it("应该在 upsert 后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 使用 upsert 创建数据
      const user = await User.upsert(
        { email: "upsert@test.com" },
        { name: "Upsert User", email: "upsert@test.com", age: 25 },
      );

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.name).toBe("Upsert User");

      // 再次使用 upsert 更新
      const user2 = await User.upsert(
        { email: "upsert@test.com" },
        { name: "Updated Upsert", email: "upsert@test.com", age: 30 },
      );

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user3 = await User.find(user2._id);
      expect(user3?.name).toBe("Updated Upsert");
      expect(user3?.age).toBe(30);
    });

    it("应该在 findOrCreate 后清除相关缓存", async () => {
      // 设置缓存适配器
      const cacheAdapter = new MemoryAdapter();
      User.cacheAdapter = cacheAdapter;
      User.cacheTTL = 60;

      // 使用 findOrCreate 创建数据
      const user = await User.findOrCreate(
        { email: "findorcreate@test.com" },
        { name: "FindOrCreate User", email: "findorcreate@test.com", age: 25 },
      );

      // 第一次查询（应该查询数据库并缓存）
      const user1 = await User.find(user._id);
      expect(user1?.name).toBe("FindOrCreate User");

      // 更新数据（需要包含所有required字段）
      await User.update(user._id, {
        name: "Updated",
        email: "findorcreate@test.com",
      });

      // 再次查询（应该查询数据库，因为缓存已被清除）
      const user2 = await User.find(user._id);
      expect(user2?.name).toBe("Updated");
    });
  },
});
