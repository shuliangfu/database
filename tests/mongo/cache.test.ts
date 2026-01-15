import { MemoryAdapter } from "@dreamer/cache";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { getDatabaseAsync } from "../../src/access.ts";
import { initDatabase } from "../../src/init-database.ts";
import { type ModelSchema, MongoModel } from "../../src/orm/mongo-model.ts";

// 定义集合名常量（使用目录名_文件名_作为前缀）
const COLLECTION_NAME = "mongo_cache_cache_test_mongo_users";

/**
 * 测试用户模型（用于 MongoDB 缓存测试）
 */
class CacheTestMongoUser extends MongoModel {
  static override collectionName = COLLECTION_NAME;
  static override primaryKey = "_id";
  static override schema: ModelSchema = {
    _id: { type: "string" as const },
    name: { type: "string" as const, validate: { required: true } },
    email: { type: "string" as const, validate: { required: true } },
    age: { type: "number" as const },
  };
}

describe("MongoModel 缓存机制测试", () => {
  let adapter: any;

  beforeAll(async () => {
    // 初始化数据库
    const mongoHost = globalThis.Deno?.env?.get("MONGO_HOST") || "localhost";
    const mongoPort = parseInt(
      globalThis.Deno?.env?.get("MONGO_PORT") || "27017",
    );
    const mongoDatabase = globalThis.Deno?.env?.get("MONGO_DATABASE") ||
      "test_mongo_cache";
    const replicaSet = globalThis.Deno?.env?.get("MONGO_REPLICA_SET") || "rs0";
    const directConnection =
      globalThis.Deno?.env?.get("MONGO_DIRECT_CONNECTION") === "true" || true;

    await initDatabase({
      type: "mongodb",
      connection: {
        host: mongoHost,
        port: mongoPort,
        database: mongoDatabase,
      },
      mongoOptions: {
        replicaSet,
        directConnection,
      },
    });
    adapter = await getDatabaseAsync();

    // 设置模型适配器
    CacheTestMongoUser.setAdapter(adapter);
  });

  beforeEach(async () => {
    // 清除之前的缓存适配器（如果存在），确保每个测试开始时状态干净
    // 这是为了防止测试之间的状态污染
    if (CacheTestMongoUser.cacheAdapter) {
      const tag = `model:${CacheTestMongoUser.collectionName}`;
      try {
        CacheTestMongoUser.cacheAdapter.deleteByTags([tag]);
      } catch (error) {
        // 忽略错误，可能适配器已经被销毁
      }
      CacheTestMongoUser.cacheAdapter = undefined;
    }
    // 重置软删除设置
    CacheTestMongoUser.softDelete = false;
  });

  afterEach(async () => {
    // 清理测试数据
    const db = (adapter as any).db;
    if (db) {
      await db.collection("cache_cache_test_mongo_users").deleteMany({});
    }
    // 清除缓存适配器的缓存（如果存在）
    // 这是为了防止测试之间的状态污染
    if (CacheTestMongoUser.cacheAdapter) {
      const tag = `model:${CacheTestMongoUser.collectionName}`;
      try {
        CacheTestMongoUser.cacheAdapter.deleteByTags([tag]);
      } catch (error) {
        // 忽略错误，可能适配器已经被销毁
      }
    }
    // 清除缓存适配器
    CacheTestMongoUser.cacheAdapter = undefined;
    // 重置软删除设置
    CacheTestMongoUser.softDelete = false;
  });

  it("应该正确缓存查询结果", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Cache User",
      email: "cache@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();
    expect(user1?.name).toBe("Cache User");

    // 第二次查询相同条件（应该从缓存获取，验证缓存键缓存工作正常）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeTruthy();
    expect(user2?.name).toBe("Cache User");
    expect(user2?._id.toString()).toBe(user._id.toString());
  });

  it("应该在数据更新后清除缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Original",
      email: "original@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.name).toBe("Original");

    // 更新数据（需要包含所有required字段）
    await CacheTestMongoUser.update(user._id, {
      name: "Updated",
      email: "original@test.com",
    });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.name).toBe("Updated");
  });

  it("应该在数据创建后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 查询所有用户（应该缓存空结果）
    const users1 = await CacheTestMongoUser.findAll();
    expect(users1.length).toBe(0);

    // 创建新用户
    await CacheTestMongoUser.create({
      name: "New User",
      email: "new@test.com",
      age: 30,
    });

    // 再次查询所有用户（应该查询数据库，因为缓存已被清除）
    const users2 = await CacheTestMongoUser.findAll();
    expect(users2.length).toBe(1);
    expect(users2[0].name).toBe("New User");
  });

  it("应该在数据删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "To Delete",
      email: "delete@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();

    // 删除数据
    await CacheTestMongoUser.delete(user._id);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeNull();
  });

  it("应该在批量创建后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 查询所有用户（应该缓存空结果）
    const users1 = await CacheTestMongoUser.findAll();
    expect(users1.length).toBe(0);

    // 批量创建用户（注意：createMany 目前没有清除缓存，但应该清除）
    await CacheTestMongoUser.createMany([
      { name: "User 1", email: "user1@test.com", age: 25 },
      { name: "User 2", email: "user2@test.com", age: 30 },
    ]);

    // 再次查询所有用户（应该查询数据库，因为缓存已被清除）
    // 注意：如果 createMany 没有清除缓存，这个测试可能会失败
    const users2 = await CacheTestMongoUser.findAll();
    expect(users2.length).toBe(2);
  });

  it("应该在批量更新后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user1 = await CacheTestMongoUser.create({
      name: "User 1",
      email: "user1@test.com",
      age: 25,
    });
    const user2 = await CacheTestMongoUser.create({
      name: "User 2",
      email: "user2@test.com",
      age: 30,
    });

    // 第一次查询（应该查询数据库并缓存）
    const users1 = await CacheTestMongoUser.findAll({ age: 25 });
    expect(users1.length).toBe(1);

    // 批量更新（注意：不能更新 _id 字段）
    await CacheTestMongoUser.updateMany({ age: 25 }, { age: 26 });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    // 注意：如果 updateMany 没有清除缓存，这个测试可能会失败
    const users2 = await CacheTestMongoUser.findAll({ age: 26 });
    expect(users2.length).toBe(1);
  });

  it("应该在批量删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    await CacheTestMongoUser.create({
      name: "User 1",
      email: "user1@test.com",
      age: 25,
    });
    await CacheTestMongoUser.create({
      name: "User 2",
      email: "user2@test.com",
      age: 30,
    });

    // 第一次查询（应该查询数据库并缓存）
    const users1 = await CacheTestMongoUser.findAll();
    expect(users1.length).toBe(2);

    // 批量删除（注意：deleteMany 目前没有清除缓存，但应该清除）
    await CacheTestMongoUser.deleteMany({ age: 25 });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    // 注意：如果 deleteMany 没有清除缓存，这个测试可能会失败
    const users2 = await CacheTestMongoUser.findAll();
    expect(users2.length).toBe(1);
  });

  it("应该在自增字段后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.age).toBe(25);

    // 自增字段
    await CacheTestMongoUser.increment(user._id, "age", 5);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.age).toBe(30);
  });

  it("应该在自减字段后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 30,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.age).toBe(30);

    // 自减字段
    await CacheTestMongoUser.decrement(user._id, "age", 5);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.age).toBe(25);
  });

  it("应该在软删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;
    CacheTestMongoUser.softDelete = true;
    CacheTestMongoUser.deletedAtField = "deletedAt";

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();

    // 软删除
    await CacheTestMongoUser.delete(user._id);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeNull();
  });

  it("应该在恢复软删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;
    CacheTestMongoUser.softDelete = true;
    CacheTestMongoUser.deletedAtField = "deletedAt";

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 软删除
    await CacheTestMongoUser.delete(user._id);

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeNull();

    // 恢复
    await CacheTestMongoUser.restore(user._id);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeTruthy();
  });

  it("应该在强制删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();

    // 强制删除
    await CacheTestMongoUser.forceDelete(user._id);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeNull();
  });

  it("缓存键缓存不应该影响查询结果的正确性", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 多次查询相同条件（应该使用缓存键缓存，但查询结果应该正确）
    const user1 = await CacheTestMongoUser.find(user._id);
    const user2 = await CacheTestMongoUser.find(user._id);
    const user3 = await CacheTestMongoUser.find(user._id);

    // 所有查询结果应该相同
    expect(user1?._id.toString()).toBe(user._id.toString());
    expect(user2?._id.toString()).toBe(user._id.toString());
    expect(user3?._id.toString()).toBe(user._id.toString());

    // 更新数据（需要包含所有required字段）
    await CacheTestMongoUser.update(user._id, {
      name: "Updated Name",
      email: "test@test.com",
    });

    // 再次查询（应该获取最新数据，即使缓存键相同）
    const user4 = await CacheTestMongoUser.find(user._id);
    expect(user4?.name).toBe("Updated Name");
  });

  it("应该在没有缓存适配器时不生成缓存键", async () => {
    // 不设置缓存适配器
    CacheTestMongoUser.cacheAdapter = undefined;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "No Cache",
      email: "nocache@test.com",
      age: 25,
    });

    // 查询（不应该生成缓存键）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();
    expect(user1?.name).toBe("No Cache");

    // 更新数据（不应该尝试清除缓存，需要包含所有required字段）
    await CacheTestMongoUser.update(user._id, {
      name: "Updated",
      email: "nocache@test.com",
    });

    // 再次查询（应该获取最新数据）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.name).toBe("Updated");
  });

  it("应该在 findOneAndUpdate 后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.name).toBe("Test User");

    // 使用 findOneAndUpdate（注意：findOneAndUpdate 目前没有清除缓存，但应该清除）
    await CacheTestMongoUser.findOneAndUpdate(
      { _id: user._id },
      { name: "Updated" },
    );

    // 再次查询（应该查询数据库，因为缓存已被清除）
    // 注意：如果 findOneAndUpdate 没有清除缓存，这个测试可能会失败
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.name).toBe("Updated");
  });

  it("应该在 findOneAndDelete 后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1).toBeTruthy();

    // 使用 findOneAndDelete（注意：findOneAndDelete 目前没有清除缓存，但应该清除）
    await CacheTestMongoUser.findOneAndDelete({ _id: user._id });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    // 注意：如果 findOneAndDelete 没有清除缓存，这个测试可能会失败
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2).toBeNull();
  });

  it("应该在 findOneAndReplace 后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestMongoUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.name).toBe("Test User");

    // 使用 findOneAndReplace
    await CacheTestMongoUser.findOneAndReplace(
      { _id: user._id },
      { name: "Replaced", email: "replaced@test.com", age: 30 },
    );

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.name).toBe("Replaced");
    expect(user2?.age).toBe(30);
  });

  it("应该在 upsert 后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 使用 upsert 创建数据
    const user = await CacheTestMongoUser.upsert(
      { email: "upsert@test.com" },
      { name: "Upsert User", email: "upsert@test.com", age: 25 },
    );

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.name).toBe("Upsert User");

    // 再次使用 upsert 更新
    const user2 = await CacheTestMongoUser.upsert(
      { email: "upsert@test.com" },
      { name: "Updated Upsert", email: "upsert@test.com", age: 30 },
    );

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user3 = await CacheTestMongoUser.find(user2._id);
    expect(user3?.name).toBe("Updated Upsert");
    expect(user3?.age).toBe(30);
  });

  it("应该在 findOrCreate 后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestMongoUser.cacheAdapter = cacheAdapter;
    CacheTestMongoUser.cacheTTL = 60;

    // 使用 findOrCreate 创建数据
    const user = await CacheTestMongoUser.findOrCreate(
      { email: "findorcreate@test.com" },
      { name: "FindOrCreate User", email: "findorcreate@test.com", age: 25 },
    );

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestMongoUser.find(user._id);
    expect(user1?.name).toBe("FindOrCreate User");

    // 更新数据（需要包含所有required字段）
    await CacheTestMongoUser.update(user._id, {
      name: "Updated",
      email: "findorcreate@test.com",
    });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestMongoUser.find(user._id);
    expect(user2?.name).toBe("Updated");
  });
}, {
  // MongoDB 客户端库可能有内部定时器和资源，禁用泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
