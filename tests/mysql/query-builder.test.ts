/**
 * @fileoverview SQLQueryBuilder 测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";
import { SQLQueryBuilder } from "../../src/query/sql-builder.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("SQLQueryBuilder", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 获取 MariaDB 连接配置
    const mariadbHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mariadbPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mariadbDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mariadbUser = getEnvWithDefault("MYSQL_USER", "root");
    const mariadbPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    adapter = new MySQLAdapter();
    await adapter.connect({
      type: "mysql",
      connection: {
        host: mariadbHost,
        port: mariadbPort,
        database: mariadbDatabase,
        username: mariadbUser,
        password: mariadbPassword,
      },
    });

    // 创建测试表（使用 MySQL/MariaDB 语法）
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INT
      )`,
      [],
    );

    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        content TEXT
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute("TRUNCATE TABLE users", []);
    await adapter.execute("TRUNCATE TABLE posts", []);

    // 插入测试数据
    await adapter.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Alice", "alice@example.com", 25],
    );
    await adapter.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Bob", "bob@example.com", 30],
    );
    await adapter.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Charlie", "charlie@example.com", 35],
    );
  });

  afterAll(async () => {
    await adapter?.close();
  });

  describe("select", () => {
    it("应该构建 SELECT 查询", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["id", "name"]).from("users");

      expect(builder.toSQL()).toContain("SELECT id, name");
      expect(builder.toSQL()).toContain("FROM users");
    });

    it("应该支持链式调用", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("users").where("age > ?", [20]);

      expect(builder.toSQL()).toContain("SELECT *");
      expect(builder.toSQL()).toContain("FROM users");
      expect(builder.toSQL()).toContain("WHERE age > ?");
    });
  });

  describe("where", () => {
    it("应该添加 WHERE 条件", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("users").where("age > ?", [20]);

      expect(builder.toSQL()).toContain("WHERE age > ?");
      expect(builder.getParams()).toEqual([20]);
    });

    it("应该支持多个 WHERE 条件（AND）", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("users")
        .where("age > ?", [20])
        .where("email LIKE ?", ["%@example.com"]);

      expect(builder.toSQL()).toContain("WHERE age > ?");
      expect(builder.toSQL()).toContain("AND email LIKE ?");
      expect(builder.getParams()).toEqual([20, "%@example.com"]);
    });
  });

  describe("orWhere", () => {
    it("应该添加 OR WHERE 条件", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("users")
        .where("age > ?", [30])
        .orWhere("name = ?", ["Alice"]);

      expect(builder.toSQL()).toContain("WHERE age > ?");
      expect(builder.toSQL()).toContain("OR name = ?");
    });
  });

  describe("join", () => {
    it("应该添加 INNER JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["users.name", "posts.title"])
        .from("users")
        .join("posts", "users.id = posts.user_id");

      expect(builder.toSQL()).toContain("INNER JOIN posts");
      expect(builder.toSQL()).toContain("ON users.id = posts.user_id");
    });

    it("应该添加 LEFT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["users.name", "posts.title"])
        .from("users")
        .leftJoin("posts", "users.id = posts.user_id");

      expect(builder.toSQL()).toContain("LEFT JOIN posts");
    });

    it("应该添加 RIGHT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["users.name", "posts.title"])
        .from("users")
        .rightJoin("posts", "users.id = posts.user_id");

      expect(builder.toSQL()).toContain("RIGHT JOIN posts");
    });
  });

  describe("orderBy", () => {
    it("应该添加 ORDER BY 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("users").orderBy("age", "DESC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
    });

    it("应该支持多个排序字段", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("users")
        .orderBy("age", "DESC")
        .orderBy("name", "ASC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
      expect(builder.toSQL()).toContain(", name ASC");
    });
  });

  describe("limit 和 offset", () => {
    it("应该添加 LIMIT 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("users").limit(10);

      expect(builder.toSQL()).toContain("LIMIT 10");
    });

    it("应该添加 OFFSET 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("users").limit(10).offset(5);

      expect(builder.toSQL()).toContain("LIMIT 10");
      expect(builder.toSQL()).toContain("OFFSET 5");
    });
  });

  describe("insert", () => {
    it("应该构建 INSERT 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.insert("users", {
        name: "David",
        email: "david@example.com",
        age: 28,
      });

      expect(builder.toSQL()).toContain("INSERT INTO users");
      expect(builder.toSQL()).toContain("name, email, age");
      expect(builder.getParams()).toEqual(["David", "david@example.com", 28]);
    });
  });

  describe("update", () => {
    it("应该构建 UPDATE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.update("users", { name: "Alice Updated" }).where("id = ?", [1]);

      expect(builder.toSQL()).toContain("UPDATE users");
      expect(builder.toSQL()).toContain("SET name = ?");
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toContain("Alice Updated");
      expect(builder.getParams()).toContain(1);
    });
  });

  describe("delete", () => {
    it("应该构建 DELETE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.delete("users").where("id = ?", [1]);

      expect(builder.toSQL()).toContain("DELETE FROM users");
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toEqual([1]);
    });
  });

  describe("execute", () => {
    it("应该执行查询并返回结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const results = await builder
        .select(["*"])
        .from("users")
        .where("age > ?", [20])
        .execute();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0] && "name" in results[0]).toBeTruthy();
    });

    it("应该执行查询并返回第一条结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .select(["*"])
        .from("users")
        .where("age > ?", [20])
        .orderBy("age", "ASC")
        .executeOne();

      expect(result).toBeTruthy();
      expect(result && "name" in result).toBeTruthy();
    });

    it("应该在无结果时返回 null", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .select(["*"])
        .from("users")
        .where("age > ?", [100])
        .executeOne();

      expect(result).toBeNull();
    });
  });

  describe("executeUpdate", () => {
    it("应该执行 INSERT 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .insert("users", {
          name: "Test User",
          email: "test@example.com",
          age: 25,
        })
        .executeUpdate();

      expect(result).toBeTruthy();

      // 验证数据已插入
      const users = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
        ["test@example.com"],
      );
      expect(users.length).toBe(1);
    });

    it("应该执行 UPDATE 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      await builder
        .update("users", { age: 26 })
        .where("email = ?", ["alice@example.com"])
        .executeUpdate();

      // 验证数据已更新
      const users = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
        ["alice@example.com"],
      );
      expect(users[0].age).toBe(26);
    });

    it("应该执行 DELETE 操作", async () => {
      // 先插入一条测试数据
      await adapter.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["Delete Test", "delete@example.com", 25],
      );

      const builder = new SQLQueryBuilder(adapter);
      await builder
        .delete("users")
        .where("email = ?", ["delete@example.com"])
        .executeUpdate();

      // 验证数据已删除
      const users = await adapter.query(
        "SELECT * FROM users WHERE email = ?",
        ["delete@example.com"],
      );
      expect(users.length).toBe(0);
    });
  });

  describe("toSQL 和 getParams", () => {
    it("应该返回构建的 SQL 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["id", "name"])
        .from("users")
        .where("age > ?", [20])
        .orderBy("name", "ASC")
        .limit(10);

      const sql = builder.toSQL();
      expect(sql).toContain("SELECT id, name");
      expect(sql).toContain("FROM users");
      expect(sql).toContain("WHERE age > ?");
      expect(sql).toContain("ORDER BY name ASC");
      expect(sql).toContain("LIMIT 10");
    });

    it("应该返回参数数组", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("users")
        .where("age > ?", [20])
        .where("name LIKE ?", ["%Alice%"]);

      const params = builder.getParams();
      expect(params).toEqual([20, "%Alice%"]);
    });
  });
}, {
  // MariaDB 客户端库可能有内部定时器和资源，禁用泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
