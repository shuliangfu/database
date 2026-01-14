/**
 * @fileoverview SQLite 事务和嵌套事务测试
 */

import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";

describe("事务测试", () => {
  let adapter: SQLiteAdapter;

  beforeEach(async () => {
    adapter = new SQLiteAdapter();
    await adapter.connect({
      type: "sqlite",
      connection: { filename: ":memory:" },
    });

    // 创建测试表
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

  describe("基本事务", () => {
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
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Bob", 100],
        );
      });

      // 验证事务已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900);
      expect(accounts[1].balance).toBe(100);
    }, { timeout: 15000 });

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
      expect(alice[0].balance).toBe(1000); // 余额未改变
    });
  });

  describe("嵌套事务（保存点）", () => {
    it("应该支持嵌套事务并提交", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务（使用保存点）
        await outerTx.transaction(async (innerTx) => {
          await innerTx.execute(
            "INSERT INTO accounts (name, balance) VALUES (?, ?)",
            ["Bob", 100],
          );
        });

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证所有操作都已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(3);
      expect(accounts[0].balance).toBe(900); // Alice
      expect(accounts[1].balance).toBe(100); // Bob
      expect(accounts[2].balance).toBe(50); // Charlie
    });

    it("嵌套事务回滚应该只回滚内层操作", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务失败（应该只回滚内层）
        try {
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              "INSERT INTO accounts (name, balance) VALUES (?, ?)",
              ["Bob", 100],
            );
            throw new Error("Inner transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证：外层操作已提交，内层操作已回滚
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900); // Alice (外层操作)
      expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
      // Bob 不应该存在（内层操作已回滚）
    });

    it("应该支持手动创建和释放保存点", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (tx) => {
        // 创建保存点
        await tx.createSavepoint("sp1");

        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 回滚到保存点
        await tx.rollbackToSavepoint("sp1");

        // 验证回滚成功
        const alice = await tx.query(
          "SELECT * FROM accounts WHERE name = ?",
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变

        // 再次操作
        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [50, "Alice"],
        );

        // 释放保存点
        await tx.releaseSavepoint("sp1");
      });

      // 验证最终状态
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(950);
    });

    it("应该在非事务上下文中调用保存点方法时抛出错误", async () => {
      // 不在事务中调用保存点方法应该抛出错误
      await assertRejects(
        async () => await adapter.createSavepoint("test"),
        Error,
      );
      await assertRejects(
        async () => await adapter.rollbackToSavepoint("test"),
        Error,
      );
      await assertRejects(
        async () => await adapter.releaseSavepoint("test"),
        Error,
      );
    });
  });
});
