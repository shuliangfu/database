import { MemoryAdapter } from "@dreamer/cache";
import { getEnv } from "@dreamer/runtime-adapter";
import { afterEach, beforeAll, describe, expect, it } from "@dreamer/test";
import { getDatabaseAsync } from "../../src/access.ts";
import { initDatabase } from "../../src/init-database.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

// 定义表名常量（使用目录名_文件名_作为前缀）
// 注意：SQLite 不允许表名以 sqlite_ 开头，因此使用 test_sqlite_ 前缀
const TABLE_NAME = "test_sqlite_cache_test_users";

/**
 * 测试用户模型（用于缓存测试）
 */
class CacheTestUser extends SQLModel {
  static override tableName = TABLE_NAME;
  static schema = {
    id: { type: "integer", primaryKey: true, autoIncrement: true },
    name: { type: "string", required: true },
    email: { type: "string", required: true },
    age: { type: "integer" },
  };
}

describe("缓存机制测试", () => {
  let adapter: any;

  beforeAll(async () => {
    // 初始化 SQLite 数据库
    await initDatabase({
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });
    adapter = await getDatabaseAsync();

    // 创建测试表（使用 SQLite 语法）
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute(`DELETE FROM ${TABLE_NAME}`, []);

    // 初始化模型
    await CacheTestUser.init();
  });

  afterEach(async () => {
    // 清理测试数据
    await adapter.execute(`DELETE FROM ${TABLE_NAME}`, []);
    // 清除缓存适配器
    CacheTestUser.cacheAdapter = undefined;
  });

  it("应该正确缓存查询结果", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestUser.cacheAdapter = cacheAdapter;
    CacheTestUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestUser.create({
      name: "Cache User",
      email: "cache@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestUser.find(user.id);
    expect(user1).toBeTruthy();
    expect(user1?.name).toBe("Cache User");

    // 第二次查询相同条件（应该从缓存获取，验证缓存键缓存工作正常）
    const user2 = await CacheTestUser.find(user.id);
    expect(user2).toBeTruthy();
    expect(user2?.name).toBe("Cache User");
    expect(user2?.id).toBe(user.id);
  });

  it("应该在数据更新后清除缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestUser.cacheAdapter = cacheAdapter;
    CacheTestUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestUser.create({
      name: "Original",
      email: "original@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestUser.find(user.id);
    expect(user1?.name).toBe("Original");

    // 更新数据
    await CacheTestUser.update(user.id, { name: "Updated" });

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestUser.find(user.id);
    expect(user2?.name).toBe("Updated");
  });

  it("应该在数据创建后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestUser.cacheAdapter = cacheAdapter;
    CacheTestUser.cacheTTL = 60;

    // 查询所有用户（应该缓存空结果）
    const users1 = await CacheTestUser.findAll();
    expect(users1.length).toBe(0);

    // 创建新用户
    await CacheTestUser.create({
      name: "New User",
      email: "new@test.com",
      age: 30,
    });

    // 再次查询所有用户（应该查询数据库，因为缓存已被清除）
    const users2 = await CacheTestUser.findAll();
    expect(users2.length).toBe(1);
    expect(users2[0].name).toBe("New User");
  });

  it("应该在数据删除后清除相关缓存", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestUser.cacheAdapter = cacheAdapter;
    CacheTestUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestUser.create({
      name: "To Delete",
      email: "delete@test.com",
      age: 25,
    });

    // 第一次查询（应该查询数据库并缓存）
    const user1 = await CacheTestUser.find(user.id);
    expect(user1).toBeTruthy();

    // 删除数据
    await CacheTestUser.delete(user.id);

    // 再次查询（应该查询数据库，因为缓存已被清除）
    const user2 = await CacheTestUser.find(user.id);
    expect(user2).toBeNull();
  });

  it("缓存键缓存不应该影响查询结果的正确性", async () => {
    // 设置缓存适配器
    const cacheAdapter = new MemoryAdapter();
    CacheTestUser.cacheAdapter = cacheAdapter;
    CacheTestUser.cacheTTL = 60;

    // 创建测试数据
    const user = await CacheTestUser.create({
      name: "Test User",
      email: "test@test.com",
      age: 25,
    });

    // 多次查询相同条件（应该使用缓存键缓存，但查询结果应该正确）
    const user1 = await CacheTestUser.find(user.id);
    const user2 = await CacheTestUser.find(user.id);
    const user3 = await CacheTestUser.find(user.id);

    // 所有查询结果应该相同
    expect(user1?.id).toBe(user.id);
    expect(user2?.id).toBe(user.id);
    expect(user3?.id).toBe(user.id);

    // 更新数据
    await CacheTestUser.update(user.id, { name: "Updated Name" });

    // 再次查询（应该获取最新数据，即使缓存键相同）
    const user4 = await CacheTestUser.find(user.id);
    expect(user4?.name).toBe("Updated Name");
  });

  it("应该在没有缓存适配器时不生成缓存键", async () => {
    // 不设置缓存适配器
    CacheTestUser.cacheAdapter = undefined;

    // 创建测试数据
    const user = await CacheTestUser.create({
      name: "No Cache",
      email: "nocache@test.com",
      age: 25,
    });

    // 查询（不应该生成缓存键）
    const user1 = await CacheTestUser.find(user.id);
    expect(user1).toBeTruthy();
    expect(user1?.name).toBe("No Cache");

    // 更新数据（不应该尝试清除缓存）
    await CacheTestUser.update(user.id, { name: "Updated" });

    // 再次查询（应该获取最新数据）
    const user2 = await CacheTestUser.find(user.id);
    expect(user2?.name).toBe("Updated");
  });
}, {
  // MariaDB 客户端库可能有内部定时器和资源，禁用泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
