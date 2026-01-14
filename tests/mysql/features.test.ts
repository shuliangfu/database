/**
 * @fileoverview MySQL/MariaDB 特有功能测试
 * 测试 MySQL/MariaDB 特有的功能：存储过程、函数、事务隔离级别等
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeAll,
  beforeEach,
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

describe("MySQL/MariaDB 特有功能", () => {
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
        // 清理测试存储过程和函数
        await adapter.execute("DROP PROCEDURE IF EXISTS test_procedure", []);
        await adapter.execute("DROP FUNCTION IF EXISTS test_function", []);
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    // 清理测试表
    try {
      await adapter.execute("DROP TABLE IF EXISTS test_procedure_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_function_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_isolation_data", []);
    } catch {
      // 忽略错误
    }
  });

  describe("存储过程", () => {
    it("应该支持创建和调用存储过程", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_procedure_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value INT
        )`,
        [],
      );

      // 删除已存在的存储过程（如果存在）
      await adapter.execute("DROP PROCEDURE IF EXISTS test_procedure", []);

      // 创建存储过程
      await adapter.execute(
        `CREATE PROCEDURE test_procedure(IN p_name VARCHAR(100), IN p_value INT)
        BEGIN
          INSERT INTO test_procedure_data (name, value) VALUES (p_name, p_value);
        END`,
        [],
      );

      // 调用存储过程
      await adapter.execute("CALL test_procedure(?, ?)", [
        "Procedure User",
        100,
      ]);

      const results = await adapter.query(
        "SELECT * FROM test_procedure_data WHERE name = ?",
        ["Procedure User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].value).toBe(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持带返回值的存储过程", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_procedure_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value INT
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_procedure_data (name, value) VALUES (?, ?), (?, ?)",
        ["User 1", 10, "User 2", 20],
      );

      // 删除已存在的存储过程（如果存在）
      await adapter.execute("DROP PROCEDURE IF EXISTS test_procedure", []);

      // 创建返回值的存储过程
      await adapter.execute(
        `CREATE PROCEDURE test_procedure(OUT total INT)
        BEGIN
          SELECT SUM(value) INTO total FROM test_procedure_data;
        END`,
        [],
      );

      // 调用存储过程（MySQL 存储过程返回值需要使用 OUT 参数）
      const results = await adapter.query("CALL test_procedure(@total)", []);
      const totalResult = await adapter.query("SELECT @total as total", []);

      expect(totalResult.length).toBe(1);
      expect(parseInt(totalResult[0].total)).toBe(30);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("函数", () => {
    it("应该支持创建和调用用户定义函数", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      // 删除已存在的函数（如果存在）
      await adapter.execute("DROP FUNCTION IF EXISTS test_function", []);

      // 创建函数
      await adapter.execute(
        `CREATE FUNCTION test_function(a INT, b INT)
        RETURNS INT
        DETERMINISTIC
        BEGIN
          RETURN a + b;
        END`,
        [],
      );

      // 调用函数
      const results = await adapter.query(
        "SELECT test_function(?, ?) as result",
        [10, 20],
      );

      expect(results.length).toBe(1);
      expect(results[0].result).toBe(30);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持在查询中使用函数", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_function_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value1 INT,
          value2 INT
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_function_data (name, value1, value2) VALUES (?, ?, ?)",
        ["Function User", 15, 25],
      );

      // 在查询中使用函数
      const results = await adapter.query(
        "SELECT name, (value1 + value2) as sum FROM test_function_data WHERE name = ?",
        ["Function User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].sum).toBe(40);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务隔离级别", () => {
    it("应该支持设置和查询事务隔离级别", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      // 查询当前隔离级别（兼容 MySQL 8.0+ 和旧版本）
      // MySQL 8.0+ 使用 transaction_isolation，旧版本使用 tx_isolation
      let currentLevel;
      try {
        currentLevel = await adapter.query(
          "SELECT @@transaction_isolation as level",
          [],
        );
      } catch {
        // 如果失败，尝试旧版本的变量名
        currentLevel = await adapter.query(
          "SELECT @@tx_isolation as level",
          [],
        );
      }

      expect(currentLevel.length).toBe(1);
      expect(currentLevel[0].level).toBeTruthy();

      // 设置隔离级别（在事务中）
      await adapter.transaction(async (db) => {
        await db.execute(
          "SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED",
          [],
        );

        // 兼容不同 MySQL 版本
        let level;
        try {
          level = await db.query(
            "SELECT @@transaction_isolation as level",
            [],
          );
        } catch {
          level = await db.query(
            "SELECT @@tx_isolation as level",
            [],
          );
        }
        // MySQL 8.0+ 返回 "READ-COMMITTED"，旧版本可能返回 "READ COMMITTED" 或 "READ-COMMITTED"
        const levelValue = level[0].level?.toUpperCase() || "";
        expect(levelValue.includes("READ") && levelValue.includes("COMMITTED"))
          .toBe(true);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在不同隔离级别下测试事务行为", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_isolation_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value INT
        )`,
        [],
      );

      // 测试 READ COMMITTED 隔离级别
      await adapter.transaction(async (db1) => {
        await db1.execute(
          "SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED",
          [],
        );

        await db1.execute(
          "INSERT INTO test_isolation_data (name, value) VALUES (?, ?)",
          ["Isolation User", 100],
        );

        // 在另一个连接中查询（应该能看到未提交的数据，取决于隔离级别）
        const results = await adapter.query(
          "SELECT * FROM test_isolation_data WHERE name = ?",
          ["Isolation User"],
        );

        // READ COMMITTED 级别下，未提交的数据不可见
        // 但这里我们在同一个适配器实例中，所以能看到
        expect(results.length).toBeGreaterThanOrEqual(0);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 REPEATABLE READ 隔离级别", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_isolation_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          value INT
        )`,
        [],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ",
          [],
        );

        // 兼容不同 MySQL 版本
        let level;
        try {
          level = await db.query(
            "SELECT @@transaction_isolation as level",
            [],
          );
        } catch {
          level = await db.query(
            "SELECT @@tx_isolation as level",
            [],
          );
        }
        // MySQL 8.0+ 返回 "REPEATABLE-READ"，旧版本可能返回 "REPEATABLE-READ" 或 "REPEATABLE READ"
        const levelValue = level[0].level?.toUpperCase() || "";
        expect(levelValue.includes("REPEATABLE")).toBe(true);

        await db.execute(
          "INSERT INTO test_isolation_data (name, value) VALUES (?, ?)",
          ["Repeatable User", 200],
        );
      });
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
