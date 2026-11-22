/**
 * @fileoverview SQLStatementBuilder 用例工厂（Mongo 查询构建器 API 不同，仍留在 tests/mongo/）
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import {
  closeDatabase,
  getDatabase,
  initDatabase,
} from "../../../src/access.ts";
import { SQLStatementBuilder } from "../../../src/query/sql-builder.ts";
import type { DatabaseAdapter } from "../../../src/types.ts";
import type { EngineFixture } from "../fixture.ts";
import { sqlPlaceholders } from "../helpers.ts";

/** 断言 SQL 片段，忽略标识符引号（MySQL ` ` / PostgreSQL " "）。 */
function expectSqlToContain(sql: string, fragment: string): void {
  const normalize = (value: string) => value.replace(/[`"]/g, "");
  expect(normalize(sql)).toContain(normalize(fragment));
}

export function registerSqlQueryBuilderTests(fx: EngineFixture): void {
  if (fx.isDocument) {
    throw new Error("registerSqlQueryBuilderTests is for SQL engines only");
  }

  const TABLE_USERS = fx.storeName("queryBuilder", "users");
  const TABLE_POSTS = fx.storeName("queryBuilder", "posts");
  const seedPh = sqlPlaceholders(fx.kind, 3);

  describe("SQLStatementBuilder", () => {
    let adapter: DatabaseAdapter;

    beforeAll(async () => {
      if (fx.kind === "postgresql") {
        try {
          await closeDatabase();
        } catch {
          // 忽略清理错误
        }
      }

      await initDatabase(fx.createConfig());
      adapter = getDatabase();

      await fx.createTable(adapter, TABLE_USERS, [
        { name: "id", type: "pk" },
        { name: "name", type: "varchar", notNull: true },
        { name: "email", type: "varchar", notNull: true, unique: true },
        { name: "age", type: "int" },
      ]);
      await fx.createTable(adapter, TABLE_POSTS, [
        { name: "id", type: "pk" },
        { name: "user_id", type: "int" },
        { name: "title", type: "varchar", notNull: true },
        { name: "content", type: "text" },
      ]);

      await adapter.execute(
        `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES (${seedPh})`,
        ["Alice", "alice@example.com", 25],
      );
      await adapter.execute(
        `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES (${seedPh})`,
        ["Bob", "bob@example.com", 30],
      );
      await adapter.execute(
        `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES (${seedPh})`,
        ["Charlie", "charlie@example.com", 35],
      );
    });

    afterAll(async () => {
      try {
        await closeDatabase();
      } catch {
        // 忽略关闭错误
      }
    });

    describe("select", () => {
      it("应该构建 SELECT 查询", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["id", "name"]).from(TABLE_USERS);

        expectSqlToContain(builder.toSQL(), "SELECT id, name");
        expectSqlToContain(builder.toSQL(), `FROM ${TABLE_USERS}`);
      });

      it("应该支持链式调用", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["*"]).from(TABLE_USERS).where("age > ?", [20]);

        expectSqlToContain(builder.toSQL(), "SELECT *");
        expectSqlToContain(builder.toSQL(), `FROM ${TABLE_USERS}`);
        expectSqlToContain(builder.toSQL(), "WHERE age > ?");
      });
    });

    describe("where", () => {
      it("应该添加 WHERE 条件", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["*"]).from(TABLE_USERS).where("age > ?", [20]);

        expectSqlToContain(builder.toSQL(), "WHERE age > ?");
        expect(builder.getParams()).toEqual([20]);
      });

      it("应该支持多个 WHERE 条件（AND）", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select(["*"])
          .from(TABLE_USERS)
          .where("age > ?", [20])
          .where("email LIKE ?", ["%@example.com"]);

        expectSqlToContain(builder.toSQL(), "WHERE age > ?");
        expectSqlToContain(builder.toSQL(), "AND email LIKE ?");
        expect(builder.getParams()).toEqual([20, "%@example.com"]);
      });
    });

    describe("orWhere", () => {
      it("应该添加 OR WHERE 条件", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select(["*"])
          .from(TABLE_USERS)
          .where("age > ?", [30])
          .orWhere("name = ?", ["Alice"]);

        expectSqlToContain(builder.toSQL(), "WHERE age > ?");
        expectSqlToContain(builder.toSQL(), "OR name = ?");
      });
    });

    describe("join", () => {
      it("应该添加 INNER JOIN", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
          .from(TABLE_USERS)
          .join(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

        expectSqlToContain(builder.toSQL(), `INNER JOIN ${TABLE_POSTS}`);
        expectSqlToContain(
          builder.toSQL(),
          `ON ${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`,
        );
      });

      it("应该添加 LEFT JOIN", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
          .from(TABLE_USERS)
          .leftJoin(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

        expectSqlToContain(builder.toSQL(), `LEFT JOIN ${TABLE_POSTS}`);
      });

      it("应该添加 RIGHT JOIN", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select([`${TABLE_USERS}.name`, `${TABLE_POSTS}.title`])
          .from(TABLE_USERS)
          .rightJoin(TABLE_POSTS, `${TABLE_USERS}.id = ${TABLE_POSTS}.user_id`);

        expectSqlToContain(builder.toSQL(), `RIGHT JOIN ${TABLE_POSTS}`);
      });
    });

    describe("orderBy", () => {
      it("应该添加 ORDER BY 子句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["*"]).from(TABLE_USERS).orderBy("age", "DESC");

        expectSqlToContain(builder.toSQL(), "ORDER BY age DESC");
      });

      it("应该支持多个排序字段", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select(["*"])
          .from(TABLE_USERS)
          .orderBy("age", "DESC")
          .orderBy("name", "ASC");

        expectSqlToContain(builder.toSQL(), "ORDER BY age DESC");
        expectSqlToContain(builder.toSQL(), ", name ASC");
      });
    });

    describe("limit 和 offset", () => {
      it("应该添加 LIMIT 子句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["*"]).from(TABLE_USERS).limit(10);

        expectSqlToContain(builder.toSQL(), "LIMIT 10");
      });

      it("应该添加 OFFSET 子句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.select(["*"]).from(TABLE_USERS).limit(10).offset(5);

        expectSqlToContain(builder.toSQL(), "LIMIT 10");
        expectSqlToContain(builder.toSQL(), "OFFSET 5");
      });
    });

    describe("insert", () => {
      it("应该构建 INSERT 语句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.insert(TABLE_USERS, {
          name: "David",
          email: "david@example.com",
          age: 28,
        });

        expectSqlToContain(builder.toSQL(), `INSERT INTO ${TABLE_USERS}`);
        expectSqlToContain(builder.toSQL(), "name, email, age");
        expect(builder.getParams()).toEqual(["David", "david@example.com", 28]);
      });
    });

    describe("update", () => {
      it("应该构建 UPDATE 语句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.update(TABLE_USERS, { name: "Alice Updated" }).where("id = ?", [
          1,
        ]);

        expectSqlToContain(builder.toSQL(), `UPDATE ${TABLE_USERS}`);
        expectSqlToContain(builder.toSQL(), "SET name = ?");
        expectSqlToContain(builder.toSQL(), "WHERE id = ?");
        expect(builder.getParams()).toContain("Alice Updated");
        expect(builder.getParams()).toContain(1);
      });
    });

    describe("delete", () => {
      it("应该构建 DELETE 语句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder.delete(TABLE_USERS).where("id = ?", [1]);

        expectSqlToContain(builder.toSQL(), `DELETE FROM ${TABLE_USERS}`);
        expectSqlToContain(builder.toSQL(), "WHERE id = ?");
        expect(builder.getParams()).toEqual([1]);
      });
    });

    describe("execute", () => {
      it("应该执行查询并返回结果", async () => {
        const builder = new SQLStatementBuilder(adapter);
        const results = await builder
          .select(["*"])
          .from(TABLE_USERS)
          .where("age > ?", [20])
          .execute();

        expect(results.length).toBeGreaterThan(0);
        expect(results[0] && "name" in results[0]).toBeTruthy();
      });

      it("应该执行查询并返回第一条结果", async () => {
        const builder = new SQLStatementBuilder(adapter);
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
        const builder = new SQLStatementBuilder(adapter);
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
        const builder = new SQLStatementBuilder(adapter);
        const result = await builder
          .insert(TABLE_USERS, {
            name: "Test User",
            email: "test@example.com",
            age: 25,
          })
          .executeUpdate();

        expect(result).toBeTruthy();

        // 验证数据已插入（与原套件一致，三库校验查询均使用 ?）
        const users = await adapter.query(
          `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
          ["test@example.com"],
        );
        expect(users.length).toBe(1);
      });

      it("应该执行 UPDATE 操作", async () => {
        const builder = new SQLStatementBuilder(adapter);
        await builder
          .update(TABLE_USERS, { age: 26 })
          .where("email = ?", ["alice@example.com"])
          .executeUpdate();

        const users = await adapter.query(
          `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
          ["alice@example.com"],
        );
        expect(users[0].age).toBe(26);
      });

      it("应该执行 DELETE 操作", async () => {
        await adapter.execute(
          `INSERT INTO ${TABLE_USERS} (name, email, age) VALUES (?, ?, ?)`,
          ["Delete Test", "delete@example.com", 25],
        );

        const builder = new SQLStatementBuilder(adapter);
        await builder
          .delete(TABLE_USERS)
          .where("email = ?", ["delete@example.com"])
          .executeUpdate();

        const users = await adapter.query(
          `SELECT * FROM ${TABLE_USERS} WHERE email = ?`,
          ["delete@example.com"],
        );
        expect(users.length).toBe(0);
      });
    });

    describe("toSQL 和 getParams", () => {
      it("应该返回构建的 SQL 语句", () => {
        const builder = new SQLStatementBuilder(adapter);
        builder
          .select(["id", "name"])
          .from(TABLE_USERS)
          .where("age > ?", [20])
          .orderBy("name", "ASC")
          .limit(10);

        const sql = builder.toSQL();
        expectSqlToContain(sql, "SELECT id, name");
        expectSqlToContain(sql, `FROM ${TABLE_USERS}`);
        expectSqlToContain(sql, "WHERE age > ?");
        expectSqlToContain(sql, "ORDER BY name ASC");
        expectSqlToContain(sql, "LIMIT 10");
      });

      it("应该返回参数数组", () => {
        const builder = new SQLStatementBuilder(adapter);
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
}
