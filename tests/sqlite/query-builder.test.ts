/**
 * @fileoverview SQLQueryBuilder 测试
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { SQLQueryBuilder } from "../../src/query/sql-builder.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

describe("SQLQueryBuilder", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表（使用 SQLite 语法）
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS sqlite_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER
      )`,
      [],
    );

    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS sqlite_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute("DELETE FROM sqlite_users", []);
    await adapter.execute("DELETE FROM sqlite_posts", []);

    // 插入测试数据
    await adapter.execute(
      "INSERT INTO sqlite_users (name, email, age) VALUES (?, ?, ?)",
      ["Alice", "alice@example.com", 25],
    );
    await adapter.execute(
      "INSERT INTO sqlite_users (name, email, age) VALUES (?, ?, ?)",
      ["Bob", "bob@example.com", 30],
    );
    await adapter.execute(
      "INSERT INTO sqlite_users (name, email, age) VALUES (?, ?, ?)",
      ["Charlie", "charlie@example.com", 35],
    );
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  describe("select", () => {
    it("应该构建 SELECT 查询", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["id", "name"]).from("sqlite_users");

      expect(builder.toSQL()).toContain("SELECT id, name");
      expect(builder.toSQL()).toContain("FROM sqlite_users");
    });

    it("应该支持链式调用", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("sqlite_users").where("age > ?", [20]);

      expect(builder.toSQL()).toContain("SELECT *");
      expect(builder.toSQL()).toContain("FROM sqlite_users");
      expect(builder.toSQL()).toContain("WHERE age > ?");
    });
  });

  describe("where", () => {
    it("应该添加 WHERE 条件", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("sqlite_users").where("age > ?", [20]);

      expect(builder.toSQL()).toContain("WHERE age > ?");
      expect(builder.getParams()).toEqual([20]);
    });

    it("应该支持多个 WHERE 条件（AND）", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("sqlite_users")
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
        .from("sqlite_users")
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
        .select(["sqlite_users.name", "sqlite_posts.title"])
        .from("sqlite_users")
        .join("sqlite_posts", "sqlite_users.id = sqlite_posts.user_id");

      expect(builder.toSQL()).toContain("INNER JOIN sqlite_posts");
      expect(builder.toSQL()).toContain("ON sqlite_users.id = sqlite_posts.user_id");
    });

    it("应该添加 LEFT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["sqlite_users.name", "sqlite_posts.title"])
        .from("sqlite_users")
        .leftJoin("sqlite_posts", "sqlite_users.id = sqlite_posts.user_id");

      expect(builder.toSQL()).toContain("LEFT JOIN sqlite_posts");
    });

    it("应该添加 RIGHT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["sqlite_users.name", "sqlite_posts.title"])
        .from("sqlite_users")
        .rightJoin("sqlite_posts", "sqlite_users.id = sqlite_posts.user_id");

      expect(builder.toSQL()).toContain("RIGHT JOIN sqlite_posts");
    });
  });

  describe("orderBy", () => {
    it("应该添加 ORDER BY 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("sqlite_users").orderBy("age", "DESC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
    });

    it("应该支持多个排序字段", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("sqlite_users")
        .orderBy("age", "DESC")
        .orderBy("name", "ASC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
      expect(builder.toSQL()).toContain(", name ASC");
    });
  });

  describe("limit 和 offset", () => {
    it("应该添加 LIMIT 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("sqlite_users").limit(10);

      expect(builder.toSQL()).toContain("LIMIT 10");
    });

    it("应该添加 OFFSET 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from("sqlite_users").limit(10).offset(5);

      expect(builder.toSQL()).toContain("LIMIT 10");
      expect(builder.toSQL()).toContain("OFFSET 5");
    });
  });

  describe("insert", () => {
    it("应该构建 INSERT 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.insert("sqlite_users", {
        name: "David",
        email: "david@example.com",
        age: 28,
      });

      expect(builder.toSQL()).toContain("INSERT INTO sqlite_users");
      expect(builder.toSQL()).toContain("name, email, age");
      expect(builder.getParams()).toEqual(["David", "david@example.com", 28]);
    });
  });

  describe("update", () => {
    it("应该构建 UPDATE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.update("sqlite_users", { name: "Alice Updated" }).where(
        "id = ?",
        [1],
      );

      expect(builder.toSQL()).toContain("UPDATE sqlite_users");
      expect(builder.toSQL()).toContain("SET name = ?");
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toContain("Alice Updated");
      expect(builder.getParams()).toContain(1);
    });
  });

  describe("delete", () => {
    it("应该构建 DELETE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.delete("sqlite_users").where("id = ?", [1]);

      expect(builder.toSQL()).toContain("DELETE FROM sqlite_users");
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toEqual([1]);
    });
  });

  describe("execute", () => {
    it("应该执行查询并返回结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const results = await builder
        .select(["*"])
        .from("sqlite_users")
        .where("age > ?", [20])
        .execute();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0] && "name" in results[0]).toBeTruthy();
    });

    it("应该执行查询并返回第一条结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .select(["*"])
        .from("sqlite_users")
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
        .from("sqlite_users")
        .where("age > ?", [100])
        .executeOne();

      expect(result).toBeNull();
    });
  });

  describe("executeUpdate", () => {
    it("应该执行 INSERT 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .insert("sqlite_users", {
          name: "Test User",
          email: "test@example.com",
          age: 25,
        })
        .executeUpdate();

      expect(result).toBeTruthy();

      // 验证数据已插入
      const users = await adapter.query(
        "SELECT * FROM sqlite_users WHERE email = ?",
        ["test@example.com"],
      );
      expect(users.length).toBe(1);
    });

    it("应该执行 UPDATE 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      await builder
        .update("sqlite_users", { age: 26 })
        .where("email = ?", ["alice@example.com"])
        .executeUpdate();

      // 验证数据已更新
      const users = await adapter.query(
        "SELECT * FROM sqlite_users WHERE email = ?",
        ["alice@example.com"],
      );
      expect(users[0].age).toBe(26);
    });

    it("应该执行 DELETE 操作", async () => {
      // 先插入一条测试数据
      await adapter.execute(
        "INSERT INTO sqlite_users (name, email, age) VALUES (?, ?, ?)",
        ["Delete Test", "delete@example.com", 25],
      );

      const builder = new SQLQueryBuilder(adapter);
      await builder
        .delete("sqlite_users")
        .where("email = ?", ["delete@example.com"])
        .executeUpdate();

      // 验证数据已删除
      const users = await adapter.query(
        "SELECT * FROM sqlite_users WHERE email = ?",
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
        .from("sqlite_users")
        .where("age > ?", [20])
        .orderBy("name", "ASC")
        .limit(10);

      const sql = builder.toSQL();
      expect(sql).toContain("SELECT id, name");
      expect(sql).toContain("FROM sqlite_users");
      expect(sql).toContain("WHERE age > ?");
      expect(sql).toContain("ORDER BY name ASC");
      expect(sql).toContain("LIMIT 10");
    });

    it("应该返回参数数组", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from("sqlite_users")
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
