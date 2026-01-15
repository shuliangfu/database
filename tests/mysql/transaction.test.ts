/**
 * @fileoverview MySQL 事务和嵌套事务测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量（跨运行时，带默认值）
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_ACCOUNTS = "mysql_transaction_accounts";

describe("事务测试", () => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    // 注意：需要实际的 MySQL 数据库连接
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    // MariaDB/MySQL 从外部连接可能需要密码，默认尝试空密码，如果失败可以通过环境变量设置
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase({
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      });

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();

      // 创建测试表
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_ACCOUNTS} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          balance INT NOT NULL DEFAULT 0
        )`,
        [],
      );

      // 清空表
      await adapter.execute(`TRUNCATE TABLE ${TABLE_ACCOUNTS}`, []);
    } catch (error) {
      // MySQL 不可用，跳过测试
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.warn(
        `MySQL not available, skipping tests. Error: ${errorMessage}`,
      );
      // 确保清理已创建的资源
      try {
        await closeDatabase();
      } catch {
        // 忽略关闭错误
      }
      adapter = null as any;
    }
  });

  afterEach(async () => {
    if (adapter) {
      try {
        // 先尝试清理表（如果连接正常）
        if (adapter.isConnected()) {
          try {
            await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_ACCOUNTS}`, []);
          } catch {
            // 忽略错误
          }
        }
      } catch {
        // 忽略错误
      }
      // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
      try {
        await closeDatabase();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  describe("基本事务", () => {
    it("应该执行事务并提交", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [100, "Alice"],
        );
        await db.execute(
          `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
          ["Bob", 100],
        );
      });

      // 验证事务已提交
      const accounts = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} ORDER BY name`,
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900);
      expect(accounts[1].balance).toBe(100);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) return;

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db) => {
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
      expect(alice[0].balance).toBe(1000); // 余额未改变
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });

  describe("嵌套事务（保存点）", () => {
    it("应该支持嵌套事务并提交", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [100, "Alice"],
        );

        // 嵌套事务（使用保存点）
        await outerTx.transaction(async (innerTx) => {
          await innerTx.execute(
            `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
            ["Bob", 100],
          );
        });

        // 外层事务继续
        await outerTx.execute(
          `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
          ["Charlie", 50],
        );
      });

      // 验证所有操作都已提交
      const accounts = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} ORDER BY name`,
        [],
      );
      expect(accounts.length).toBe(3);
      expect(accounts[0].balance).toBe(900); // Alice
      expect(accounts[1].balance).toBe(100); // Bob
      expect(accounts[2].balance).toBe(50); // Charlie
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("嵌套事务回滚应该只回滚内层操作", async () => {
      if (!adapter) return;

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [100, "Alice"],
        );

        // 嵌套事务失败（应该只回滚内层）
        try {
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
              ["Bob", 100],
            );
            throw new Error("Inner transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 外层事务继续
        await outerTx.execute(
          `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
          ["Charlie", 50],
        );
      });

      // 验证：外层操作已提交，内层操作已回滚
      const accounts = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} ORDER BY name`,
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900); // Alice (外层操作)
      expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
      // Bob 不应该存在（内层操作已回滚）
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该支持手动创建和释放保存点", async () => {
      if (!adapter) return;

      await adapter.execute(
        `INSERT INTO ${TABLE_ACCOUNTS} (name, balance) VALUES (?, ?)`,
        ["Alice", 1000],
      );

      await adapter.transaction(async (tx) => {
        // 创建保存点
        await tx.createSavepoint("sp1");

        await tx.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [100, "Alice"],
        );

        // 回滚到保存点
        await tx.rollbackToSavepoint("sp1");

        // 验证回滚成功
        const alice = await tx.query(
          `SELECT * FROM ${TABLE_ACCOUNTS} WHERE name = ?`,
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变

        // 再次操作
        await tx.execute(
          `UPDATE ${TABLE_ACCOUNTS} SET balance = balance - ? WHERE name = ?`,
          [50, "Alice"],
        );

        // 释放保存点
        await tx.releaseSavepoint("sp1");
      });

      // 验证最终状态
      const alice = await adapter.query(
        `SELECT * FROM ${TABLE_ACCOUNTS} WHERE name = ?`,
        ["Alice"],
      );
      expect(alice[0].balance).toBe(950);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });
});
