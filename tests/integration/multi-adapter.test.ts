/**
 * @fileoverview 多适配器集成测试
 * 测试同时使用多个数据库适配器的场景（MySQL、SQLite、MongoDB）
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMongoConfig } from "../mongo/mongo-test-utils.ts";
import { createMysqlConfig } from "../mysql/mysql-test-utils.ts";

/** MongoDB 集合名 */
const MONGO_COLLECTION = "multi_mongo_users";

describe("多适配器集成测试", () => {
  let mysqlAdapter: DatabaseAdapter;
  let sqliteAdapter: DatabaseAdapter;
  let mongoAdapter: DatabaseAdapter | null = null;

  beforeAll(async () => {
    // 使用 initDatabase 初始化 MySQL 连接
    await initDatabase(createMysqlConfig(), "mysql");

    // 使用 initDatabase 初始化 SQLite 连接
    await initDatabase({
      adapter: "sqlite",
      connection: {
        filename: ":memory:",
      },
    }, "sqlite");

    // 使用 initDatabase 初始化 MongoDB 连接（可选，MongoDB 不可用时跳过）
    try {
      await initDatabase(createMongoConfig(), "mongo");
      mongoAdapter = getDatabase("mongo");
      // MongoDB 无需建表，使用集合即可
    } catch (error) {
      console.warn(
        `MongoDB not available, mongo tests will be skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // 使用 getDatabase 获取连接
    mysqlAdapter = getDatabase("mysql");
    sqliteAdapter = getDatabase("sqlite");

    // 创建 MySQL 测试表并清空
    await mysqlAdapter.execute(
      `CREATE TABLE IF NOT EXISTS multi_mysql_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
      )`,
      [],
    );
    await mysqlAdapter.execute("TRUNCATE TABLE multi_mysql_users", []);

    // 创建 SQLite 测试表并清空
    await sqliteAdapter.execute(
      `CREATE TABLE IF NOT EXISTS multi_sqlite_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )`,
      [],
    );
    await sqliteAdapter.execute("DELETE FROM multi_sqlite_users", []);

    // 清空 MongoDB 集合（若已连接）
    if (mongoAdapter) {
      await mongoAdapter.execute("deleteMany", MONGO_COLLECTION, {
        filter: {},
      });
    }
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭所有连接
    await closeDatabase();
  });

  it("应该能够同时操作多个数据库", async () => {
    if (!mysqlAdapter || !sqliteAdapter) {
      console.log("Adapters not available, skipping test");
      return;
    }

    // 在 MySQL 中插入数据
    await mysqlAdapter.execute(
      "INSERT INTO multi_mysql_users (name, email) VALUES (?, ?)",
      ["MySQL User", "mysql@test.com"],
    );

    // 在 SQLite 中插入数据
    await sqliteAdapter.execute(
      "INSERT INTO multi_sqlite_users (name, email) VALUES (?, ?)",
      ["SQLite User", "sqlite@test.com"],
    );

    // 在 MongoDB 中插入数据（若已连接）
    if (mongoAdapter) {
      await mongoAdapter.execute("insert", MONGO_COLLECTION, {
        name: "Mongo User",
        email: "mongo@test.com",
      });
    }

    // 从 MySQL 查询
    const mysqlUsers = await mysqlAdapter.query(
      "SELECT * FROM multi_mysql_users WHERE email = ?",
      ["mysql@test.com"],
    );
    expect(mysqlUsers.length).toBe(1);
    expect(mysqlUsers[0].name).toBe("MySQL User");

    // 从 SQLite 查询
    const sqliteUsers = await sqliteAdapter.query(
      "SELECT * FROM multi_sqlite_users WHERE email = ?",
      ["sqlite@test.com"],
    );
    expect(sqliteUsers.length).toBe(1);
    expect(sqliteUsers[0].name).toBe("SQLite User");

    // 从 MongoDB 查询（若已连接）
    if (mongoAdapter) {
      const mongoUsers = await mongoAdapter.query(
        MONGO_COLLECTION,
        { email: "mongo@test.com" },
        {},
      );
      expect(mongoUsers.length).toBe(1);
      expect(mongoUsers[0].name).toBe("Mongo User");
    }
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该能够在不同数据库间同步数据", async () => {
    if (!mysqlAdapter || !sqliteAdapter) {
      console.log("Adapters not available, skipping test");
      return;
    }

    // 从 MySQL 读取数据
    const mysqlUsers = await mysqlAdapter.query(
      "SELECT * FROM multi_mysql_users",
      [],
    );

    // 同步到 SQLite
    for (const user of mysqlUsers) {
      await sqliteAdapter.execute(
        "INSERT OR IGNORE INTO multi_sqlite_users (name, email) VALUES (?, ?)",
        [user.name, user.email],
      );
    }

    // 同步到 MongoDB（若已连接）
    if (mongoAdapter) {
      for (const user of mysqlUsers) {
        try {
          await mongoAdapter.execute("insert", MONGO_COLLECTION, {
            name: user.name,
            email: user.email,
          });
        } catch {
          // 忽略重复键等错误
        }
      }
    }

    // 验证 SQLite 同步结果
    const sqliteUsers = await sqliteAdapter.query(
      "SELECT * FROM multi_sqlite_users",
      [],
    );
    expect(sqliteUsers.length).toBeGreaterThanOrEqual(mysqlUsers.length);

    // 验证 MongoDB 同步结果（若已连接）
    if (mongoAdapter) {
      const mongoUsers = await mongoAdapter.query(
        MONGO_COLLECTION,
        {},
        {},
      );
      expect(mongoUsers.length).toBeGreaterThanOrEqual(mysqlUsers.length);
    }
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该能够独立管理每个连接的状态", async () => {
    if (!mysqlAdapter || !sqliteAdapter) {
      console.log("Adapters not available, skipping test");
      return;
    }

    // 检查 MySQL 连接状态
    expect(mysqlAdapter.isConnected()).toBe(true);
    const mysqlStatus = await mysqlAdapter.getPoolStatus();
    expect(mysqlStatus).toBeTruthy();

    // 检查 SQLite 连接状态
    expect(sqliteAdapter.isConnected()).toBe(true);
    const sqliteStatus = await sqliteAdapter.getPoolStatus();
    expect(sqliteStatus).toBeTruthy();

    // 检查 MongoDB 连接状态（若已连接）
    if (mongoAdapter) {
      expect(mongoAdapter.isConnected()).toBe(true);
      const mongoStatus = await mongoAdapter.getPoolStatus();
      expect(mongoStatus).toBeTruthy();
      expect(mongoAdapter).not.toBe(mysqlAdapter);
      expect(mongoAdapter).not.toBe(sqliteAdapter);
    }

    // 各连接应该独立
    expect(mysqlAdapter).not.toBe(sqliteAdapter);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
