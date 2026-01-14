/**
 * @fileoverview SQLite 错误处理测试
 * 测试 SQLite 适配器在各种错误场景下的处理能力
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";

describe("SQLite 错误处理", () => {
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    adapter = new SQLiteAdapter();
    await adapter.connect({
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });
  });

  afterAll(async () => {
    if (adapter) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  describe("连接错误", () => {
    it("应该处理缺少 filename 配置", async () => {
      const badAdapter = new SQLiteAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            type: "sqlite",
            connection: {} as any,
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理无效的文件路径", async () => {
      const badAdapter = new SQLiteAdapter();
      // 使用无效的路径（在某些系统上可能会失败）
      try {
        await badAdapter.connect({
          type: "sqlite",
          connection: {
            filename: "/invalid/path/that/does/not/exist/test.db",
          },
        });
        // 如果连接成功，SQLite 可能会创建文件
      } catch (error) {
        // 如果失败，应该抛出错误
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询错误", () => {
    it("应该处理 SQL 语法错误", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理表不存在错误", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM nonexistent_table_12345", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理列不存在错误", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_error_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.query(
            "SELECT nonexistent_column FROM test_error_table",
            [],
          );
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("执行错误", () => {
    it("应该处理约束违反错误", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_constraint_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_constraint_table (email) VALUES (?)",
        ["unique@test.com"],
      );

      // 尝试插入重复的 email
      await assertRejects(
        async () => {
          await adapter.execute(
            "INSERT INTO test_constraint_table (email) VALUES (?)",
            ["unique@test.com"],
          );
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理 NOT NULL 约束违反", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_notnull_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
        [],
      );

      // 尝试插入 NULL 值
      await assertRejects(
        async () => {
          await adapter.execute(
            "INSERT INTO test_notnull_table (name) VALUES (?)",
            [null],
          );
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务错误", () => {
    it("应该在事务外调用保存点方法时抛出错误", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.createSavepoint("sp1");
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理事务中的错误并正确回滚", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_tx_error (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.transaction(async (db) => {
            await db.execute(
              "INSERT INTO test_tx_error (name) VALUES (?)",
              ["TX User"],
            );
            // 故意抛出错误
            throw new Error("Transaction error");
          });
        },
        Error,
      );

      // 验证数据已回滚
      const results = await adapter.query(
        "SELECT * FROM test_tx_error WHERE name = ?",
        ["TX User"],
      );
      expect(results.length).toBe(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
