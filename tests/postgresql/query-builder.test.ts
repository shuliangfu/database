/**
 * @fileoverview SQLQueryBuilder 测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { SQLQueryBuilder } from "../../src/query/sql-builder.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_USERS = "postgresql_query_builder_users";
const TABLE_POSTS = "postgresql_query_builder_posts";

describe("SQLQueryBuilder", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
    } catch {
      // 忽略清理错误
    }

    // 获取 PostgreSQL 连接配置
    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    // 使用 initDatabase 初始化全局 dbManager
    await initDatabase({
      type: "postgresql",
      connection: {
        host: pgHost,
        port: pgPort,
        database: pgDatabase,
        username: pgUser,
        password: pgPassword,
      },
    });

    // 从全局 dbManager 获取适配器
    adapter = getDatabase();

    // 创建测试表（使用 PostgreSQL 语法）
    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_USERS} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER
      )`,
      [],
    );

    await adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_POSTS} (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        title VARCHAR(255) NOT NULL,
        content TEXT
      )`,
      [],
    );

    // 清空测试数据
    await adapter.execute(`TRUNCATE TABLE ${TABLE_USERS}`, []);
    await adapter.execute(`TRUNCATE TABLE ${TABLE_POSTS}`, []);

    // 插入测试数据
    await adapter.execute(
      `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES ($1, $2, $3)`,
      ["Alice", "alice@example.com", 25],
    );
    await adapter.execute(
      `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES ($1, $2, $3)`,
      ["Bob", "bob@example.com", 30],
    );
    await adapter.execute(
      `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES ($1, $2, $3)`,
      ["Charlie", "charlie@example.com", 35],
    );
  });

  afterAll(async () => {
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    try {
      await closeDatabase();
    } catch {
      // 忽略关闭错误
    }
  });

  // 每个测试后强制等待连接释放，防止连接泄漏
  afterEach(async () => {
    if (adapter && adapter.isConnected()) {
      try {
        // 获取连接池状态并检查（已移除延时以提升测试速度）
        const status = await adapter.getPoolStatus();
        // 如果活跃连接过多，记录警告但不等待
        if (status.active > 2) {
          console.warn(`警告：连接池中有 ${status.active} 个活跃连接`);
        }
      } catch {
        // 忽略错误
      }
    }
  });

  describe("select", () => {
    it("应该构建 SELECT 查询", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["id", "name"]).from(TABLE_USERS);

      expect(builder.toSQL()).toContain("SELECT id, name");
      expect(builder.toSQL()).toContain(`FROM ${TABLE_USERS}`);
    });

    it("应该支持链式调用", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from(TABLE_USERS).where("age > ?", [20]);

      expect(builder.toSQL()).toContain("SELECT *");
      expect(builder.toSQL()).toContain(`FROM ${TABLE_USERS}`);
      expect(builder.toSQL()).toContain("WHERE age > ?");
    });
  });

  describe("where", () => {
    it("应该添加 WHERE 条件", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from(TABLE_USERS).where("age > ?", [20]);

      expect(builder.toSQL()).toContain("WHERE age > ?");
      expect(builder.getParams()).toEqual([20]);
    });

    it("应该支持多个 WHERE 条件（AND）", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from(TABLE_USERS)
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
        .from(TABLE_USERS)
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
        .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
        .from(TABLE_USERS)
        .join(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

      expect(builder.toSQL()).toContain(`INNER JOIN ${TABLE_POSTS}`);
      expect(builder.toSQL()).toContain(
        `ON ${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`,
      );
    });

    it("应该添加 LEFT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
        .from(TABLE_USERS)
        .leftJoin(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

      expect(builder.toSQL()).toContain(`LEFT JOIN ${TABLE_POSTS}`);
    });

    it("应该添加 RIGHT JOIN", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
        .from(TABLE_USERS)
        .rightJoin(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

      expect(builder.toSQL()).toContain(`RIGHT JOIN ${TABLE_POSTS}`);
    });
  });

  describe("orderBy", () => {
    it("应该添加 ORDER BY 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from(TABLE_USERS).orderBy("age", "DESC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
    });

    it("应该支持多个排序字段", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from(TABLE_USERS)
        .orderBy("age", "DESC")
        .orderBy("name", "ASC");

      expect(builder.toSQL()).toContain("ORDER BY age DESC");
      expect(builder.toSQL()).toContain(", name ASC");
    });
  });

  describe("limit 和 offset", () => {
    it("应该添加 LIMIT 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from(TABLE_USERS).limit(10);

      expect(builder.toSQL()).toContain("LIMIT 10");
    });

    it("应该添加 OFFSET 子句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.select(["*"]).from(TABLE_USERS).limit(10).offset(5);

      expect(builder.toSQL()).toContain("LIMIT 10");
      expect(builder.toSQL()).toContain("OFFSET 5");
    });
  });

  describe("insert", () => {
    it("应该构建 INSERT 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.insert(TABLE_USERS, {
        name: "David",
        email: "david@example.com",
        age: 28,
      });

      expect(builder.toSQL()).toContain(`INSERT INTO ${TABLE_USERS}`);
      expect(builder.toSQL()).toContain("name, email, age");
      expect(builder.getParams()).toEqual(["David", "david@example.com", 28]);
    });
  });

  describe("update", () => {
    it("应该构建 UPDATE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.update(TABLE_USERS, { name: "Alice Updated" }).where("id = ?", [
        1,
      ]);

      expect(builder.toSQL()).toContain(`UPDATE ${TABLE_USERS}`);
      expect(builder.toSQL()).toContain("SET name = ?");
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toContain("Alice Updated");
      expect(builder.getParams()).toContain(1);
    });
  });

  describe("delete", () => {
    it("应该构建 DELETE 语句", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder.delete(TABLE_USERS).where("id = ?", [1]);

      expect(builder.toSQL()).toContain(`DELETE FROM ${TABLE_USERS}`);
      expect(builder.toSQL()).toContain("WHERE id = ?");
      expect(builder.getParams()).toEqual([1]);
    });
  });

  describe("execute", () => {
    it("应该执行查询并返回结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const results = await builder
        .select(["*"])
        .from(TABLE_USERS)
        .where("age > ?", [20])
        .execute();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0] && "name" in results[0]).toBeTruthy();
    });

    it("应该执行查询并返回第一条结果", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .select(["*"])
        .from(TABLE_USERS)
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
        .from(TABLE_USERS)
        .where("age > ?", [100])
        .executeOne();

      expect(result).toBeNull();
    });
  });

  describe("executeUpdate", () => {
    it("应该执行 INSERT 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      const result = await builder
        .insert(TABLE_USERS, {
          name: "Test User",
          email: "test@example.com",
          age: 25,
        })
        .executeUpdate();

      expect(result).toBeTruthy();

      // 验证数据已插入
      const users = await adapter.query(
        `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
        ["test@example.com"],
      );
      expect(users.length).toBe(1);
    });

    it("应该执行 UPDATE 操作", async () => {
      const builder = new SQLQueryBuilder(adapter);
      await builder
        .update(TABLE_USERS, { age: 26 })
        .where("email = ?", ["alice@example.com"])
        .executeUpdate();

      // 验证数据已更新
      const users = await adapter.query(
        `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
        ["alice@example.com"],
      );
      expect(users[0].age).toBe(26);
    });

    it("应该执行 DELETE 操作", async () => {
      // 先插入一条测试数据
      await adapter.execute(
        `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES (?, ?, ?)`,
        ["Delete Test", "delete@example.com", 25],
      );

      const builder = new SQLQueryBuilder(adapter);
      await builder
        .delete(TABLE_USERS)
        .where("email = ?", ["delete@example.com"])
        .executeUpdate();

      // 验证数据已删除
      const users = await adapter.query(
        `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
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
        .from(TABLE_USERS)
        .where("age > ?", [20])
        .orderBy("name", "ASC")
        .limit(10);

      const sql = builder.toSQL();
      expect(sql).toContain("SELECT id, name");
      expect(sql).toContain(`FROM ${TABLE_USERS}`);
      expect(sql).toContain("WHERE age > ?");
      expect(sql).toContain("ORDER BY name ASC");
      expect(sql).toContain("LIMIT 10");
    });

    it("应该返回参数数组", () => {
      const builder = new SQLQueryBuilder(adapter);
      builder
        .select(["*"])
        .from(TABLE_USERS)
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
