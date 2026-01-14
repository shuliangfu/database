/**
 * @fileoverview MySQL/MariaDB 错误处理测试
 * 测试 MySQL/MariaDB 适配器在各种错误场景下的处理能力
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  assertRejects,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("MySQL/MariaDB 错误处理", () => {
  let adapter: MySQLAdapter;

  beforeAll(async () => {
    adapter = new MySQLAdapter();
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    try {
      await adapter.connect({
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      });
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
    if (adapter) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  describe("连接错误", () => {
    it("应该处理无效的主机名", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            type: "mysql",
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
            type: "mysql",
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
            type: "mysql",
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
        `CREATE TABLE IF NOT EXISTS test_error_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100)
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

      await adapter.execute("DROP TABLE IF EXISTS test_error_table", []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("执行错误", () => {
    it("应该处理约束违反错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_constraint_table (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL
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

      await adapter.execute("DROP TABLE IF EXISTS test_constraint_table", []);
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
        `CREATE TABLE IF NOT EXISTS test_tx_error (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100)
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

      await adapter.execute("DROP TABLE IF EXISTS test_tx_error", []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池错误", () => {
    it("应该在连接池关闭后拒绝新查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      await testAdapter.connect({
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      });

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
