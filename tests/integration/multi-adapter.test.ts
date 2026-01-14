/**
 * @fileoverview 多适配器集成测试
 * 测试同时使用多个数据库适配器的场景
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { DatabaseManager } from "../../src/manager.ts";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("多适配器集成测试", () => {
  let manager: DatabaseManager;
  let mysqlAdapter: DatabaseAdapter;
  let sqliteAdapter: DatabaseAdapter;

  beforeAll(async () => {
    manager = new DatabaseManager();

    // 连接 MySQL
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    await manager.connect("mysql", {
      type: "mysql",
      connection: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDatabase,
        username: mysqlUser,
        password: mysqlPassword,
      },
    });

    // 连接 SQLite
    await manager.connect("sqlite", {
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });

    mysqlAdapter = manager.getConnection("mysql");
    sqliteAdapter = manager.getConnection("sqlite");

    // 创建测试表
    await mysqlAdapter.execute(
      `CREATE TABLE IF NOT EXISTS multi_mysql_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
      )`,
      [],
    );

    await sqliteAdapter.execute(
      `CREATE TABLE IF NOT EXISTS multi_sqlite_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )`,
      [],
    );
  });

  afterAll(async () => {
    await manager?.closeAll();
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

    // 验证同步结果
    const sqliteUsers = await sqliteAdapter.query(
      "SELECT * FROM multi_sqlite_users",
      [],
    );
    expect(sqliteUsers.length).toBeGreaterThanOrEqual(mysqlUsers.length);
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

    // 两个连接应该独立
    expect(mysqlAdapter).not.toBe(sqliteAdapter);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
