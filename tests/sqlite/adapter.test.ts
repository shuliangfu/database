/**
 * @fileoverview SQLiteAdapter 测试
 */

import { cwd, join, remove } from "@dreamer/runtime-adapter";
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
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";
import { QueryLogger } from "../../src/logger/query-logger.ts";
import type { DatabaseAdapter, DatabaseConfig } from "../../src/types.ts";

// 定义表名常量（使用目录名_文件名_作为前缀）
// 注意：SQLite 不允许表名以 sqlite_ 开头，因此使用 test_sqlite_ 前缀
const TABLE_NAME = "test_sqlite_adapter_users";
const TABLE_ACCOUNTS = "test_sqlite_adapter_accounts";
const TABLE_SAVEPOINTS = "test_sqlite_adapter_test_savepoints";

describe("SQLiteAdapter", () => {
  const testDbPath = join(cwd(), "test.db");
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 清理测试数据库文件
    try {
      await remove(testDbPath);
    } catch {
      // 文件不存在，忽略
    }
  });

  afterAll(async () => {
    // 直接关闭适配器连接
    if (adapter && adapter.isConnected()) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
    // 清理测试数据库文件
    try {
      await remove(testDbPath);
    } catch {
      // 忽略错误
    }
  });

  describe("connect", () => {
    it("应该连接到内存数据库", async () => {
      adapter = new SQLiteAdapter();
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      await adapter.connect(config);

      expect(adapter.isConnected()).toBe(true);
    });

    it("应该连接到文件数据库", async () => {
      adapter = new SQLiteAdapter();
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: testDbPath,
        },
      };

      await adapter.connect(config);

      expect(adapter.isConnected()).toBe(true);
    });

    it("应该使用自定义 SQLite 选项", async () => {
      adapter = new SQLiteAdapter();
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
        sqliteOptions: {
          readonly: false,
          fileMustExist: false,
          timeout: 10000,
        },
      };

      await adapter.connect(config);

      expect(adapter.isConnected()).toBe(true);
    });

    it("应该在缺少 filename 时抛出错误", async () => {
      adapter = new SQLiteAdapter();
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {},
      };

      await assertRejects(() => adapter.connect(config), Error);
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      // 创建测试表
      await adapter.execute(
        `CREATE TABLE ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          age INTEGER
        )`,
        [],
      );

      // 插入测试数据
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Alice", "alice@example.com", 25],
      );
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Bob", "bob@example.com", 30],
      );
    });

    afterEach(async () => {
      await adapter?.close();
    });

    it("应该执行 SELECT 查询并返回结果", async () => {
      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age > ?`,
        [20],
      );

      expect(results.length).toBe(2);
      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Bob");
    });

    it("应该支持参数化查询", async () => {
      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["alice@example.com"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
    });

    it("应该返回空数组当没有匹配的记录", async () => {
      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["nonexistent@example.com"],
      );

      expect(results.length).toBe(0);
    });

    it("应该在未连接时抛出错误", async () => {
      const newAdapter = new SQLiteAdapter();

      await assertRejects(
        () => newAdapter.query("SELECT * FROM users", []),
        Error,
      );
    });
  });

  describe("execute", () => {
    beforeEach(async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL
        )`,
        [],
      );
    });

    afterEach(async () => {
      await adapter?.close();
    });

    it("应该执行 INSERT 语句", async () => {
      const result = await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email) VALUES (?, ?)`,
        ["Alice", "alice@example.com"],
      );

      expect(result).toBeTruthy();
      expect((result as any).lastInsertRowid).toBeTruthy();

      // 验证数据已插入
      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    it("应该执行 UPDATE 语句", async () => {
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email) VALUES (?, ?)`,
        ["Alice", "alice@example.com"],
      );

      const result = await adapter.execute(
        `UPDATE ${TABLE_NAME} SET name = ? WHERE email = ?`,
        ["Alice Updated", "alice@example.com"],
      );

      expect(result).toBeTruthy();

      // 验证数据已更新
      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["alice@example.com"],
      );
      expect(users[0].name).toBe("Alice Updated");
    });

    it("应该执行 DELETE 语句", async () => {
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email) VALUES (?, ?)`,
        ["Alice", "alice@example.com"],
      );

      const result = await adapter.execute(
        `DELETE FROM ${TABLE_NAME} WHERE email = ?`,
        ["alice@example.com"],
      );

      expect(result).toBeTruthy();

      // 验证数据已删除
      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(0);
    });

    it("应该在未连接时抛出错误", async () => {
      const newAdapter = new SQLiteAdapter();

      await assertRejects(
        () =>
          newAdapter.execute(`INSERT INTO ${TABLE_NAME} (name) VALUES (?)`, [
            "Alice",
          ]),
        Error,
      );
    });
  });

  describe("transaction", () => {
    beforeEach(async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE ${TABLE_ACCOUNTS} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          balance INTEGER NOT NULL DEFAULT 0
        )`,
        [],
      );
    });

    afterEach(async () => {
      await adapter?.close();
    });

    it("应该执行事务并提交", async () => {
      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [100, "Alice"],
        );
        await db.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance + ? WHERE name = ?`,
          [100, "Bob"],
        );
      });

      // 验证事务已提交
      const alice = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} WHERE name = ?`,
        ["Alice"],
      );
      expect(alice[0].balance).toBe(900);
    });

    it("应该在事务中回滚错误", async () => {
      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db: DatabaseAdapter) => {
          await db.execute(
            `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
            [100, "Alice"],
          );
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const alice = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} WHERE name = ?`,
        ["Alice"],
      );
      expect(alice[0].balance).toBe(1000);
    });
  });

  describe("close", () => {
    it("应该关闭数据库连接", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      expect(adapter.isConnected()).toBe(true);

      await adapter.close();

      expect(adapter.isConnected()).toBe(false);
    });

    it("应该可以多次调用 close 而不出错", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.close();
      await adapter.close(); // 第二次调用不应该出错
    });
  });

  describe("getPoolStatus", () => {
    it("应该返回连接池状态", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const status = await adapter.getPoolStatus();

      expect(status).toBeTruthy();
      // SQLite 是文件数据库，连接池状态表示已连接
      expect(status.total).toBe(1);
      expect(status.active).toBe(1);
      expect(status.idle).toBe(0);
      expect(status.waiting).toBe(0);
    });
  });

  describe("healthCheck", () => {
    it("应该返回健康检查结果", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const result = await adapter.healthCheck();

      expect(result).toBeTruthy();
      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it("应该在未连接时返回不健康状态", async () => {
      adapter = new SQLiteAdapter();

      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("isConnected", () => {
    it("应该在连接后返回 true", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      expect(adapter.isConnected()).toBe(true);
    });

    it("应该在关闭后返回 false", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.close();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("savepoints", () => {
    it("应该支持创建保存点", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_SAVEPOINTS} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_SAVEPOINTS} (name, value) VALUES (?, ?)`,
          ["Test", 10],
        );

        await db.createSavepoint("sp1");

        await db.execute(
          `UPDATE ${TABLE_SAVEPOINTS} SET value = ? WHERE name = ?`,
          [20, "Test"],
        );

        const row = await db.query(
          `SELECT * FROM ${TABLE_SAVEPOINTS} WHERE name = ?`,
          ["Test"],
        );
        expect(row[0].value).toBe(20);

        await db.rollbackToSavepoint("sp1");

        const rowAfterRollback = await db.query(
          `SELECT * FROM ${TABLE_SAVEPOINTS} WHERE name = ?`,
          ["Test"],
        );
        expect(rowAfterRollback[0].value).toBe(10);
      });

      await adapter.close();
    });

    it("应该支持释放保存点", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_SAVEPOINTS} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_SAVEPOINTS} (name, value) VALUES (?, ?)`,
          ["Release", 10],
        );

        await db.createSavepoint("sp1");
        await db.releaseSavepoint("sp1");

        // 释放后应该不能再回滚
        await assertRejects(
          async () => {
            await db.rollbackToSavepoint("sp1");
          },
          Error,
        );
      });

      await adapter.close();
    });
  });

  describe("query logger", () => {
    it("应该支持设置和获取查询日志记录器", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const { QueryLogger } = await import("../../src/logger/query-logger.ts");
      const logger = new QueryLogger();

      adapter.setQueryLogger(logger);
      expect(adapter.getQueryLogger()).toBe(logger);

      // 执行一个查询，验证日志记录
      await adapter.query("SELECT 1", []);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].type).toBe("query");

      await adapter.close();
    });
  });

  describe("BaseAdapter 辅助方法", () => {
    describe("getLastHealthCheck", () => {
      it("应该在初始状态下返回 null", () => {
        const newAdapter = new SQLiteAdapter();
        expect(newAdapter.getLastHealthCheck()).toBeNull();
      });

      it("应该在健康检查后返回时间", async () => {
        const newAdapter = new SQLiteAdapter();
        const config: DatabaseConfig = {
          adapter: "sqlite",
          connection: {
            filename: ":memory:",
          },
        };
        await newAdapter.connect(config);

        const before = new Date();
        await newAdapter.healthCheck();
        const after = new Date();

        const lastCheck = newAdapter.getLastHealthCheck();
        expect(lastCheck).toBeTruthy();
        expect(lastCheck).toBeInstanceOf(Date);
        if (lastCheck) {
          expect(lastCheck.getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(lastCheck.getTime()).toBeLessThanOrEqual(after.getTime());
        }

        await newAdapter.close();
      });
    });

    describe("setHealthCheckInterval", () => {
      it("应该设置健康检查间隔", () => {
        const newAdapter = new SQLiteAdapter();
        newAdapter.setHealthCheckInterval(60000);

        expect(newAdapter).toBeTruthy();
      });

      it("应该支持不同的间隔值", () => {
        const newAdapter = new SQLiteAdapter();
        newAdapter.setHealthCheckInterval(1000);
        newAdapter.setHealthCheckInterval(5000);
        newAdapter.setHealthCheckInterval(30000);

        expect(newAdapter).toBeTruthy();
      });
    });

    describe("setQueryLogger", () => {
      it("应该设置查询日志记录器", () => {
        const logger = new QueryLogger();
        adapter.setQueryLogger(logger);

        const retrievedLogger = adapter.getQueryLogger();
        expect(retrievedLogger).toBe(logger);
      });

      it("应该支持替换日志记录器", () => {
        const logger1 = new QueryLogger();
        const logger2 = new QueryLogger();

        adapter.setQueryLogger(logger1);
        expect(adapter.getQueryLogger()).toBe(logger1);

        adapter.setQueryLogger(logger2);
        expect(adapter.getQueryLogger()).toBe(logger2);
      });

      it("应该支持设置为 null", () => {
        const logger = new QueryLogger();
        adapter.setQueryLogger(logger);
        expect(adapter.getQueryLogger()).toBe(logger);

        const newAdapter = new SQLiteAdapter();
        expect(newAdapter.getQueryLogger()).toBeNull();
      });
    });

    describe("getQueryLogger", () => {
      it("应该在未设置时返回 null", async () => {
        const newAdapter = new SQLiteAdapter();
        const config: DatabaseConfig = {
          adapter: "sqlite",
          connection: {
            filename: ":memory:",
          },
        };
        await newAdapter.connect(config);

        expect(newAdapter.getQueryLogger()).toBeNull();

        await newAdapter.close();
      });

      it("应该返回设置的日志记录器", () => {
        const logger = new QueryLogger({
          enabled: true,
          logLevel: "all",
        });

        adapter.setQueryLogger(logger);
        const retrievedLogger = adapter.getQueryLogger();

        expect(retrievedLogger).toBe(logger);
        expect(retrievedLogger?.getLogger()).toBeTruthy();
      });
    });

    describe("isConnected", () => {
      it("应该在连接后返回 true", async () => {
        // 确保 adapter 已连接
        if (!adapter.isConnected()) {
          const config: DatabaseConfig = {
            adapter: "sqlite",
            connection: {
              filename: ":memory:",
            },
          };
          await adapter.connect(config);
        }
        expect(adapter.isConnected()).toBe(true);
      });

      it("应该在未连接时返回 false", async () => {
        const newAdapter = new SQLiteAdapter();
        expect(newAdapter.isConnected()).toBe(false);

        const config: DatabaseConfig = {
          adapter: "sqlite",
          connection: {
            filename: ":memory:",
          },
        };
        await newAdapter.connect(config);
        expect(newAdapter.isConnected()).toBe(true);

        await newAdapter.close();
        expect(newAdapter.isConnected()).toBe(false);
      });
    });
  });

  describe("事务适配器", () => {
    it("应该在事务适配器中执行查询", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Transaction User", "tx@test.com", 25],
        );

        const users = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["tx@test.com"],
        );
        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Transaction User");
      });

      await adapter.close();
    });

    it("应该在事务适配器中执行更新", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Update User", "update@test.com", 25],
        );

        const result = await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "update@test.com"],
        );
        expect(result.affectedRows).toBeGreaterThan(0);

        const users = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["update@test.com"],
        );
        expect(users[0].age).toBe(30);
      });

      await adapter.close();
    });

    it("应该在事务适配器中获取连接池状态", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const status = await db.getPoolStatus();
        expect(status.total).toBe(1);
        expect(status.active).toBe(1);
        expect(status.idle).toBe(0);
      });

      await adapter.close();
    });

    it("应该在事务适配器中执行健康检查", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const health = await db.healthCheck();
        expect(health.healthy).toBe(true);
        expect(health.latency).toBeGreaterThanOrEqual(0);
      });

      await adapter.close();
    });

    it("应该禁止在事务适配器中关闭连接", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.close();
          });
        },
        Error,
      );

      await adapter.close();
    });

    it("应该支持嵌套事务", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db1: DatabaseAdapter) => {
        await db1.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Nested User", "nested@test.com", 25],
        );

        await db1.transaction(async (db2: DatabaseAdapter) => {
          await db2.execute(
            `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
            [30, "nested@test.com"],
          );
        });

        const users = await db1.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["nested@test.com"],
        );
        expect(users[0].age).toBe(30);
      });

      await adapter.close();
    });
  });

  describe("保存点高级功能", () => {
    it("应该处理保存点名称冲突", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Conflict User", "conflict@test.com", 25],
        );

        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "conflict@test.com"],
        );

        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [35, "conflict@test.com"],
        );

        await db.rollbackToSavepoint("sp1");
        const user = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["conflict@test.com"],
        );
        expect(user[0].age).toBe(30);
      });

      await adapter.close();
    });

    it("应该处理保存点不存在的情况", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.rollbackToSavepoint("nonexistent");
          });
        },
        Error,
      );

      await adapter.close();
    });

    it("应该支持多层保存点", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Multi User", "multi@test.com", 10],
        );

        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [20, "multi@test.com"],
        );

        await db.createSavepoint("sp2");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "multi@test.com"],
        );

        await db.createSavepoint("sp3");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [40, "multi@test.com"],
        );

        await db.rollbackToSavepoint("sp2");
        const user = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["multi@test.com"],
        );
        // 回滚到 sp2 后，age 应该是 30（sp2 创建时的值）
        // 但 SQLite 的保存点行为与 PostgreSQL 相同，回滚到保存点会恢复到保存点创建时的状态
        expect(user[0].age).toBe(20); // 回滚到 sp2 会恢复到 sp2 创建时的状态，即 20
      });

      await adapter.close();
    });
  });

  describe("复杂SQL查询", () => {
    it("应该支持JOIN查询", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_ACCOUNTS} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          product TEXT,
          price REAL
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Join User", "join@test.com", 25],
      );

      const users = await adapter.query(
        `SELECT id FROM ${TABLE_NAME} WHERE email = ?`,
        ["join@test.com"],
      );
      const userId = users[0].id;

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (user_id, product, price) VALUES (?, ?, ?)`,
        [userId, "Product A", 100.50],
      );

      const results = await adapter.query(
        `SELECT u.name, u.email, o.product, o.price
         FROM ${TABLE_NAME} u
         JOIN ${TABLE_ACCOUNTS} o ON u.id = o.user_id
         WHERE u.email = ?`,
        ["join@test.com"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Join User");
      expect(results[0].product).toBe("Product A");

      await adapter.close();
    });

    it("应该支持聚合函数", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          30,
          "User 3",
          "user3@test.com",
          40,
        ],
      );

      const result = await adapter.query(
        `SELECT COUNT(*) as count, AVG(age) as avg_age, MAX(age) as max_age, MIN(age) as min_age FROM ${TABLE_NAME}`,
        [],
      );

      expect(result[0].count).toBe(3);
      // Bun 测试运行器不支持 toBeCloseTo，使用范围检查代替
      const avgAge = Number(result[0].avg_age);
      expect(avgAge).toBeGreaterThanOrEqual(29);
      expect(avgAge).toBeLessThanOrEqual(31);
      expect(result[0].max_age).toBe(40);
      expect(result[0].min_age).toBe(20);

      await adapter.close();
    });

    it("应该支持子查询", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?)`,
        ["Young User", "young@test.com", 20, "Old User", "old@test.com", 50],
      );

      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age > (SELECT AVG(age) FROM ${TABLE_NAME})`,
        [],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Old User");

      await adapter.close();
    });
  });

  describe("批量操作", () => {
    it("应该支持批量插入", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.transaction(async (db: DatabaseAdapter) => {
        for (let i = 1; i <= 5; i++) {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
            [`Batch User ${i}`, `batch${i}@test.com`, 20 + i],
          );
        }
      });

      const count = await adapter.query(
        `SELECT COUNT(*) as count FROM ${TABLE_NAME}`,
        [],
      );
      expect(count[0].count).toBe(5);

      await adapter.close();
    });

    it("应该支持批量更新", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          20,
          "User 3",
          "user3@test.com",
          20,
        ],
      );

      const result = await adapter.execute(
        `UPDATE ${TABLE_NAME} SET age = ? WHERE age = ?`,
        [30, 20],
      );

      expect(result.affectedRows).toBeGreaterThan(0);

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age = ?`,
        [30],
      );
      expect(users.length).toBe(3);

      await adapter.close();
    });

    it("应该支持批量删除", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          30,
          "User 3",
          "user3@test.com",
          40,
        ],
      );

      const result = await adapter.execute(
        `DELETE FROM ${TABLE_NAME} WHERE age < ?`,
        [35],
      );

      expect(result.affectedRows).toBeGreaterThan(0);

      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(1);

      await adapter.close();
    });

    it("应该支持获取最后插入的行ID", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      const result = await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["ID User", "id@test.com", 25],
      );

      // SQLite adapter 返回的是 lastInsertRowid，不是 insertId
      expect(result.lastInsertRowid).toBeGreaterThan(0);

      await adapter.close();
    });
  });

  describe("查询日志记录", () => {
    it("应该记录查询日志", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.query("SELECT 1 as test", []);
      await adapter.query("SELECT 2 as test", []);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((log) => log.type === "query")).toBe(true);
      expect(logs.some((log) => log.sql?.includes("SELECT"))).toBe(true);

      await adapter.close();
    });

    it("应该记录执行日志", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Log User", "log@test.com", 25],
      );

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some((log) => log.type === "execute")).toBe(true);

      await adapter.close();
    });

    it("应该记录错误日志", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      try {
        await adapter.query("SELECT * FROM nonexistent_table", []);
      } catch {
        // 忽略错误
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      await adapter.close();
    });
  });

  describe("边界条件", () => {
    it("应该处理空参数数组", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const result = await adapter.query("SELECT 1 as test", []);
      expect(result.length).toBe(1);
      expect(result[0].test).toBe(1);

      await adapter.close();
    });

    it("应该处理null参数", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Null User", null, null],
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE name = ?`,
        ["Null User"],
      );
      expect(users.length).toBe(1);
      expect(users[0].email).toBeNull();
      expect(users[0].age).toBeNull();

      await adapter.close();
    });

    it("应该处理特殊字符", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      const specialName = 'User\'s Name & "Special" <Chars>';
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        [specialName, "special@test.com", 25],
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["special@test.com"],
      );
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(specialName);

      await adapter.close();
    });

    it("应该防止SQL注入", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      const maliciousInput = "'; DROP TABLE test_users; --";
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        [maliciousInput, "inject@test.com", 25],
      );

      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(maliciousInput);

      await adapter.close();
    });
  });

  describe("错误处理", () => {
    it("应该处理缺少filename配置", async () => {
      const badAdapter = new SQLiteAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            adapter: "sqlite",
            connection: {} as any,
          });
        },
        Error,
      );
    });

    it("应该处理SQL语法错误", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM", []);
        },
        Error,
      );

      await adapter.close();
    });

    it("应该处理表不存在错误", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM nonexistent_table_12345", []);
        },
        Error,
      );

      await adapter.close();
    });
  });

  describe("并发操作", () => {
    it("应该支持并发查询", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      for (let i = 1; i <= 10; i++) {
        await adapter.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          [`Concurrent User ${i}`, `concurrent${i}@test.com`, 20 + i],
        );
      }

      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          [`concurrent${i + 1}@test.com`],
        ));

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach((result, index) => {
        expect(result.length).toBe(1);
        expect(result[0].email).toBe(`concurrent${index + 1}@test.com`);
      });

      await adapter.close();
    });

    it("应该支持并发事务", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      // SQLite 不支持真正的并发事务（同一连接），需要串行执行
      // 但我们可以测试多个事务依次执行
      for (let i = 0; i < 5; i++) {
        await adapter.transaction(async (db: DatabaseAdapter) => {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
            [`Concurrent TX User ${i}`, `concurrent_tx${i}@test.com`, 20 + i],
          );
          return i;
        });
      }

      const count = await adapter.query(
        `SELECT COUNT(*) as count FROM ${TABLE_NAME}`,
        [],
      );
      expect(count[0].count).toBe(5);

      await adapter.close();
    });
  });

  describe("查询日志详细验证", () => {
    it("应该记录查询的详细信息", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.query("SELECT ? as test", [42]);

      const logs = logger.getLogs();
      const queryLog = logs.find((log) => log.type === "query");
      expect(queryLog).toBeTruthy();
      if (queryLog) {
        expect(queryLog.sql).toContain("SELECT");
        expect(queryLog.params).toEqual([42]);
        expect(queryLog.duration).toBeGreaterThanOrEqual(0);
      }

      await adapter.close();
    });

    it("应该记录执行的详细信息", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          age INTEGER
        )`,
        [],
      );

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Log Detail User", "log_detail@test.com", 25],
      );

      const logs = logger.getLogs();
      const executeLog = logs.find((log) => log.type === "execute");
      expect(executeLog).toBeTruthy();
      if (executeLog) {
        expect(executeLog.sql).toContain("INSERT");
        expect(executeLog.params).toEqual([
          "Log Detail User",
          "log_detail@test.com",
          25,
        ]);
        expect(executeLog.duration).toBeGreaterThanOrEqual(0);
      }

      await adapter.close();
    });
  });
});
