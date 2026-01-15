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
const TABLE_NAME = "mysql_cache_test_users";

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
    // 获取 MariaDB 连接配置
    const mariadbHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mariadbPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mariadbDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mariadbUser = getEnvWithDefault("MYSQL_USER", "root");
    const mariadbPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    // 初始化数据库
    await initDatabase({
      type: "mysql",
      connection: {
        host: mariadbHost,
        port: mariadbPort,
        database: mariadbDatabase,
        username: mariadbUser,
        password: mariadbPassword,
      },
    });
    adapter = await getDatabaseAsync();

    // 创建测试表（使用 MySQL/MariaDB 语法）
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        age INT
      )`,
      [],
    );

    // 初始化模型
    await CacheTestUser.init();
  });

  afterEach(async () => {
    // 清理测试数据
    await adapter.execute("TRUNCATE TABLE mysql_cache_test_users", []);
    // 清除缓存适配器的缓存（如果存在）
    if (CacheTestUser.cacheAdapter) {
      const tag = `model:${CacheTestUser.tableName}`;
      CacheTestUser.cacheAdapter.deleteByTags([tag]);
    }
    // 清除缓存适配器
    CacheTestUser.cacheAdapter = undefined;
  });

  describe("缓存操作", () => {
    it("应该从缓存读取数据", async () => {
      const cacheAdapter = new MemoryAdapter();
      CacheTestUser.cacheAdapter = cacheAdapter;
      CacheTestUser.cacheTTL = 60;

      // 创建数据
      const user = await CacheTestUser.create({
        name: "Cached User",
        email: "cached@example.com",
        age: 25,
      });

      // 查询应该从数据库读取
      const user1 = await CacheTestUser.find(user.id);
      expect(user1).toBeTruthy();
      expect(user1?.name).toBe("Cached User");

      // 再次查询应该从缓存读取
      const user2 = await CacheTestUser.find(user.id);
      expect(user2).toBeTruthy();
      expect(user2?.name).toBe("Cached User");
    });

    it("应该在创建数据后清除缓存", async () => {
      const cacheAdapter = new MemoryAdapter();
      CacheTestUser.cacheAdapter = cacheAdapter;
      CacheTestUser.cacheTTL = 60;

      // 创建数据
      const user = await CacheTestUser.create({
        name: "New User",
        email: "new@example.com",
        age: 30,
      });

      // 查询应该从数据库读取（缓存已清除）
      const foundUser = await CacheTestUser.find(user.id);
      expect(foundUser).toBeTruthy();
      expect(foundUser?.name).toBe("New User");
    });

    it("应该在更新数据后清除缓存", async () => {
      const cacheAdapter = new MemoryAdapter();
      CacheTestUser.cacheAdapter = cacheAdapter;
      CacheTestUser.cacheTTL = 60;

      // 创建数据
      const user = await CacheTestUser.create({
        name: "Update User",
        email: "update@example.com",
        age: 25,
      });

      // 更新数据
      await CacheTestUser.update(user.id, { name: "Updated User" });

      // 查询应该从数据库读取（缓存已清除）
      const foundUser = await CacheTestUser.find(user.id);
      expect(foundUser).toBeTruthy();
      expect(foundUser?.name).toBe("Updated User");
    });

    it("应该在删除数据后清除缓存", async () => {
      const cacheAdapter = new MemoryAdapter();
      CacheTestUser.cacheAdapter = cacheAdapter;
      CacheTestUser.cacheTTL = 60;

      // 创建数据
      const user = await CacheTestUser.create({
        name: "Delete User",
        email: "delete@example.com",
        age: 25,
      });

      // 删除数据
      await CacheTestUser.delete(user.id);

      // 查询应该返回 null（缓存已清除）
      const foundUser = await CacheTestUser.find(user.id);
      expect(foundUser).toBeNull();
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
