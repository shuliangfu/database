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
import { SQLiteAdapter } from "../src/adapters/sqlite.ts";
import type { DatabaseConfig } from "../src/types.ts";

describe("SQLiteAdapter", () => {
  const testDbPath = join(cwd(), "test.db");
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    // 清理测试数据库文件
    try {
      await remove(testDbPath);
    } catch {
      // 文件不存在，忽略
    }
  });

  afterAll(async () => {
    // 清理测试数据库文件
    try {
      await adapter?.close();
      await remove(testDbPath);
    } catch {
      // 忽略错误
    }
  });

  describe("connect", () => {
    it("应该连接到内存数据库", async () => {
      adapter = new SQLiteAdapter();
      const config: DatabaseConfig = {
        type: "sqlite",
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
        type: "sqlite",
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
        type: "sqlite",
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
        type: "sqlite",
        connection: {},
      };

      await assertRejects(() => adapter.connect(config), Error);
    });
  });

  describe("query", () => {
    beforeEach(async () => {
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
          age INTEGER
        )`,
        [],
      );

      // 插入测试数据
      await adapter.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["Alice", "alice@example.com", 25],
      );
      await adapter.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["Bob", "bob@example.com", 30],
      );
    });

    afterEach(async () => {
      await adapter?.close();
    });

    it("应该执行 SELECT 查询并返回结果", async () => {
      const results = await adapter.query(
        "SELECT * FROM users WHERE age > ?",
        [20],
      );

      expect(results.length).toBe(2);
      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Bob");
    });

    it("应该支持参数化查询", async () => {
      const results = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
        ["alice@example.com"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
    });

    it("应该返回空数组当没有匹配的记录", async () => {
      const results = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
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
        type: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE users (
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
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Alice", "alice@example.com"],
      );

      expect(result).toBeTruthy();
      expect((result as any).lastInsertRowid).toBeTruthy();

      // 验证数据已插入
      const users = await adapter.query("SELECT * FROM users", []);
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });

    it("应该执行 UPDATE 语句", async () => {
      await adapter.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Alice", "alice@example.com"],
      );

      const result = await adapter.execute(
        "UPDATE users SET name = ? WHERE email = ?",
        ["Alice Updated", "alice@example.com"],
      );

      expect(result).toBeTruthy();

      // 验证数据已更新
      const users = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
        ["alice@example.com"],
      );
      expect(users[0].name).toBe("Alice Updated");
    });

    it("应该执行 DELETE 语句", async () => {
      await adapter.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Alice", "alice@example.com"],
      );

      const result = await adapter.execute(
        "DELETE FROM users WHERE email = ?",
        ["alice@example.com"],
      );

      expect(result).toBeTruthy();

      // 验证数据已删除
      const users = await adapter.query("SELECT * FROM users", []);
      expect(users.length).toBe(0);
    });

    it("应该在未连接时抛出错误", async () => {
      const newAdapter = new SQLiteAdapter();

      await assertRejects(
        () =>
          newAdapter.execute("INSERT INTO users (name) VALUES (?)", ["Alice"]),
        Error,
      );
    });
  });

  describe("transaction", () => {
    beforeEach(async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        type: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.execute(
        `CREATE TABLE accounts (
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
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );
        await db.execute(
          "UPDATE accounts SET balance = balance + ? WHERE name = ?",
          [100, "Bob"],
        );
      });

      // 验证事务已提交
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(900);
    });

    it("应该在事务中回滚错误", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db) => {
          await db.execute(
            "UPDATE accounts SET balance = balance - ? WHERE name = ?",
            [100, "Alice"],
          );
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(1000);
    });
  });

  describe("close", () => {
    it("应该关闭数据库连接", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        type: "sqlite",
        connection: { filename: ":memory:" },
      });

      expect(adapter.isConnected()).toBe(true);

      await adapter.close();

      expect(adapter.isConnected()).toBe(false);
    });

    it("应该可以多次调用 close 而不出错", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        type: "sqlite",
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
        type: "sqlite",
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
        type: "sqlite",
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
        type: "sqlite",
        connection: { filename: ":memory:" },
      });

      expect(adapter.isConnected()).toBe(true);
    });

    it("应该在关闭后返回 false", async () => {
      adapter = new SQLiteAdapter();
      await adapter.connect({
        type: "sqlite",
        connection: { filename: ":memory:" },
      });

      await adapter.close();

      expect(adapter.isConnected()).toBe(false);
    });
  });
});
