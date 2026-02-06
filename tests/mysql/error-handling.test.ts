/**
 * @fileoverview MySQL/MariaDB 错误处理测试
 * 测试 MySQL/MariaDB 适配器在各种错误场景下的处理能力
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMysqlConfig } from "./mysql-test-utils.ts";

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_ERROR = "mysql_error_handling_test_error_table";
const TABLE_CONSTRAINT = "mysql_error_handling_test_constraint_table";
const TABLE_TX = "mysql_error_handling_test_tx_error";

describe("MySQL/MariaDB 错误处理", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase(createMysqlConfig());

      // 从全局 dbManager 获取适配器
      adapter = getDatabase();
    } catch (error) {
      console.warn(
        `MySQL not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  describe("连接错误", () => {
    it("应该处理无效的主机名", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            adapter: "mysql",
            connection: {
              host: "invalid_host_that_does_not_exist_12345",
              port: 3306,
              database: "test",
              username: "test",
              password: "test",
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该处理无效的端口", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            adapter: "mysql",
            connection: {
              host: "localhost",
              port: 99999,
              database: "test",
              username: "test",
              password: "test",
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该处理无效的数据库名", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            adapter: "mysql",
            connection: {
              host: "localhost",
              port: 3306,
              database: "nonexistent_database_12345",
              username: "test",
              password: "test",
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("查询错误", () => {
    it("应该处理 SQL 语法错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
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
        console.log("MySQL not available, skipping test");
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
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_ERROR} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100)
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.query(
            `SELECT nonexistent_column FROM ${TABLE_ERROR}`,
            [],
          );
        },
        Error,
      );

      await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_ERROR}`, []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("执行错误", () => {
    it("应该处理约束违反错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_CONSTRAINT} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_CONSTRAINT} (email) VALUES (?)`,
        ["unique@test.com"],
      );

      // 尝试插入重复的 email
      await assertRejects(
        async () => {
          await adapter.execute(
            `INSERT INTO ${TABLE_CONSTRAINT} (email) VALUES (?)`,
            ["unique@test.com"],
          );
        },
        Error,
      );

      await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_CONSTRAINT}`, []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务错误", () => {
    it("应该在事务外调用保存点方法时抛出错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
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
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_TX} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100)
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.transaction(async (db) => {
            await db.execute(
              `INSERT INTO ${TABLE_TX} (name) VALUES (?)`,
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
        `SELECT * FROM ${TABLE_TX} WHERE name = ?`,
        ["TX User"],
      );
      expect(results.length).toBe(0);

      await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_TX}`, []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池错误", () => {
    it("应该在连接池关闭后拒绝新查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      await testAdapter.connect(createMysqlConfig());

      await testAdapter.close();

      // 关闭后应该无法查询
      await assertRejects(
        async () => {
          await testAdapter.query("SELECT 1", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
