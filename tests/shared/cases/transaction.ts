/**
 * @fileoverview SQL 事务与保存点用例工厂（Mongo 事务 API 不同，仍留在 tests/mongo/）
 */

import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import {
  closeDatabase,
  getDatabase,
  initDatabase,
} from "../../../src/access.ts";
import type { DatabaseAdapter } from "../../../src/types.ts";
import type { EngineFixture } from "../fixture.ts";
import { sqlPlaceholder } from "../helpers.ts";

export function registerSqlTransactionTests(fx: EngineFixture): void {
  if (fx.isDocument) {
    throw new Error("registerSqlTransactionTests is for SQL engines only");
  }

  const TABLE = fx.storeName("transaction", "accounts");
  const p1 = sqlPlaceholder(fx.kind, 1);
  const p2 = sqlPlaceholder(fx.kind, 2);
  const sanitize = fx.kind !== "sqlite"
    ? { sanitizeResources: false as const, sanitizeOps: false as const }
    : undefined;

  describe("事务测试", () => {
    let adapter: DatabaseAdapter | null;

    beforeEach(async () => {
      adapter = null;
      try {
        await initDatabase(fx.createConfig());
        adapter = getDatabase();
        await fx.createTable(adapter, TABLE, [
          { name: "id", type: "pk" },
          { name: "name", type: "varchar", notNull: true },
          { name: "balance", type: "int", notNull: true, defaultSql: "0" },
        ]);
      } catch (error) {
        if (fx.kind === "sqlite") throw error;
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        console.warn(
          `${fx.label} not available, skipping tests. Error: ${errorMessage}`,
        );
        try {
          await closeDatabase();
        } catch {
          // 忽略关闭错误
        }
        adapter = null;
      }
    });

    afterEach(async () => {
      if (adapter) {
        if (fx.kind !== "sqlite") {
          try {
            if (adapter.isConnected()) {
              try {
                await fx.dropStore(adapter, TABLE);
              } catch {
                // 忽略错误
              }
            }
          } catch {
            // 忽略错误
          }
        }
        try {
          await closeDatabase();
        } catch {
          // 忽略关闭错误
        }
      } else if (fx.kind === "sqlite") {
        await closeDatabase();
      }
    });

    function itCase(
      name: string,
      fn: () => Promise<void>,
      extra?: { timeout?: number },
    ) {
      const options = {
        ...(sanitize ?? {}),
        ...(extra ?? {}),
      };
      if (Object.keys(options).length > 0) {
        it(name, fn, options);
      } else {
        it(name, fn);
      }
    }

    describe("基本事务", () => {
      itCase("应该执行事务并提交", async () => {
        if (!adapter) {
          console.log(`${fx.label} not available, skipping test`);
          return;
        }

        await adapter.execute(
          `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
          ["Alice", 1000],
        );

        await adapter.transaction(async (db) => {
          await db.execute(
            `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
            [100, "Alice"],
          );
          await db.execute(
            `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
            ["Bob", 100],
          );
        });

        // 验证事务已提交
        const accounts = await adapter.query(
          `SELECT * FROM ${TABLE} ORDER BY name`,
          [],
        );
        expect(accounts.length).toBe(2);
        expect(accounts[0].balance).toBe(900);
        expect(accounts[1].balance).toBe(100);
      }, fx.kind === "sqlite" ? { timeout: 15000 } : undefined);

      itCase("应该在事务中回滚错误", async () => {
        if (!adapter) {
          console.log(`${fx.label} not available, skipping test`);
          return;
        }

        await adapter.execute(
          `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
          ["Alice", 1000],
        );

        try {
          await adapter.transaction(async (db) => {
            await db.execute(
              `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
              [100, "Alice"],
            );
            throw new Error("Transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 验证事务已回滚
        const alice = await adapter.query(
          `SELECT * FROM ${TABLE} WHERE name = ${p1}`,
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变
      });
    });

    describe("嵌套事务（保存点）", () => {
      itCase("应该支持嵌套事务并提交", async () => {
        if (!adapter) {
          console.log(`${fx.label} not available, skipping test`);
          return;
        }

        await adapter.execute(
          `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
          ["Alice", 1000],
        );

        await adapter.transaction(async (outerTx) => {
          // 外层事务操作
          await outerTx.execute(
            `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
            [100, "Alice"],
          );

          // 嵌套事务（使用保存点）
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
              ["Bob", 100],
            );
          });

          // 外层事务继续
          await outerTx.execute(
            `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
            ["Charlie", 50],
          );
        });

        // 验证所有操作都已提交
        const accounts = await adapter.query(
          `SELECT * FROM ${TABLE} ORDER BY name`,
          [],
        );
        expect(accounts.length).toBe(3);
        expect(accounts[0].balance).toBe(900); // Alice
        expect(accounts[1].balance).toBe(100); // Bob
        expect(accounts[2].balance).toBe(50); // Charlie
      });

      itCase("嵌套事务回滚应该只回滚内层操作", async () => {
        if (!adapter) {
          console.log(`${fx.label} not available, skipping test`);
          return;
        }

        await adapter.execute(
          `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
          ["Alice", 1000],
        );

        await adapter.transaction(async (outerTx) => {
          // 外层事务操作
          await outerTx.execute(
            `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
            [100, "Alice"],
          );

          // 嵌套事务失败（应该只回滚内层）
          try {
            await outerTx.transaction(async (innerTx) => {
              await innerTx.execute(
                `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
                ["Bob", 100],
              );
              throw new Error("Inner transaction error");
            });
          } catch {
            // 预期会抛出错误
          }

          // 外层事务继续
          await outerTx.execute(
            `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
            ["Charlie", 50],
          );
        });

        // 验证：外层操作已提交，内层操作已回滚
        const accounts = await adapter.query(
          `SELECT * FROM ${TABLE} ORDER BY name`,
          [],
        );
        expect(accounts.length).toBe(2);
        expect(accounts[0].balance).toBe(900); // Alice (外层操作)
        expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
        // Bob 不应该存在（内层操作已回滚）
      });

      itCase("应该支持手动创建和释放保存点", async () => {
        if (!adapter) {
          console.log(`${fx.label} not available, skipping test`);
          return;
        }

        await adapter.execute(
          `INSERT INTO ${TABLE} (name, balance) VALUES (${p1}, ${p2})`,
          ["Alice", 1000],
        );

        await adapter.transaction(async (tx) => {
          // 创建保存点
          await tx.createSavepoint("sp1");

          await tx.execute(
            `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
            [100, "Alice"],
          );

          // 回滚到保存点
          await tx.rollbackToSavepoint("sp1");

          // 验证回滚成功
          const alice = await tx.query(
            `SELECT * FROM ${TABLE} WHERE name = ${p1}`,
            ["Alice"],
          );
          expect(alice[0].balance).toBe(1000); // 余额未改变

          // 再次操作
          await tx.execute(
            `UPDATE ${TABLE} SET balance = balance - ${p1} WHERE name = ${p2}`,
            [50, "Alice"],
          );

          // 释放保存点
          await tx.releaseSavepoint("sp1");
        });

        // 验证最终状态
        const alice = await adapter.query(
          `SELECT * FROM ${TABLE} WHERE name = ${p1}`,
          ["Alice"],
        );
        expect(alice[0].balance).toBe(950);
      });

      // 该用例原先只在 SQLite 套件中，不向 MySQL/PG 扩展
      if (fx.kind === "sqlite") {
        it("应该在非事务上下文中调用保存点方法时抛出错误", async () => {
          if (!adapter) return;
          await assertRejects(
            async () => await adapter!.createSavepoint("test"),
            Error,
          );
          await assertRejects(
            async () => await adapter!.rollbackToSavepoint("test"),
            Error,
          );
          await assertRejects(
            async () => await adapter!.releaseSavepoint("test"),
            Error,
          );
        });
      }
    });
  });
}
