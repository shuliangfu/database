/**
 * SQL 方言下沉与 SQLite 语句缓存的定向测试。
 */
import { afterAll, afterEach, describe, expect, it } from "@dreamer/test";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";
import {
  buildMySqlUpsertSql,
  buildPostgresUpsertSql,
  formatSqlDateTime,
  InvalidSqlIdentifierError,
  quoteMySqlIdentifier,
  quotePostgresIdentifier,
  quoteSqliteIdentifier,
} from "../../src/adapters/sql-dialect.ts";

describe("SQL 方言能力", () => {
  it("按方言引用标识符", () => {
    expect(quoteSqliteIdentifier("createdAt")).toBe("createdAt");
    expect(quoteMySqlIdentifier("createdAt")).toBe("`createdAt`");
    expect(quotePostgresIdentifier("createdAt")).toBe('"createdAt"');
    expect(quotePostgresIdentifier("email")).toBe("email");
  });

  it("拒绝注入型标识符", () => {
    const bad = [
      "foo;drop",
      "foo bar",
      "foo\nbar",
      'foo"bar',
      "foo`bar",
      "__proto__",
      "constructor",
      "",
    ];
    for (const name of bad) {
      expect(() => quoteSqliteIdentifier(name)).toThrow(
        InvalidSqlIdentifierError,
      );
      expect(() => quoteMySqlIdentifier(name)).toThrow(
        InvalidSqlIdentifierError,
      );
      expect(() => quotePostgresIdentifier(name)).toThrow(
        InvalidSqlIdentifierError,
      );
    }
    expect(quoteSqliteIdentifier("users.id")).toBe("users.id");
    expect(quoteMySqlIdentifier("users.id")).toBe("`users`.`id`");
  });

  it("生成与原先一致的日期格式", () => {
    const date = new Date(2026, 0, 2, 3, 4, 5, 678);
    expect(formatSqlDateTime(date)).toBe("2026-01-02 03:04:05");
  });

  it("构建 PostgreSQL / MySQL 方言 upsert SQL", () => {
    expect(buildPostgresUpsertSql("users", ["email", "name"], ["email"]))
      .toBe(
        "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name RETURNING *",
      );
    expect(buildMySqlUpsertSql("users", ["email", "name"])).toBe(
      "INSERT INTO `users` (`email`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `name` = VALUES(`name`)",
    );
  });

  it("SQLiteAdapter 暴露方言方法并生成 DELETE + 序列重置", () => {
    const adapter = new SQLiteAdapter();
    expect(adapter.sqlDialect).toBe("sqlite");
    expect(adapter.quoteIdentifier("createdAt")).toBe("createdAt");
    expect(adapter.shouldUseReturning("insert")).toBe(false);
    expect(adapter.shouldUseReturning("insertMany")).toBe(true);
    expect(adapter.shouldUseReturning("update", { returnLatest: true })).toBe(
      true,
    );
    expect(adapter.shouldUseReturning("increment", { returnLatest: true }))
      .toBe(true);
    expect(adapter.supportsDialectUpsert(["email"])).toBe(false);
    expect(adapter.buildTruncateStatements("users")).toEqual([
      { sql: "DELETE FROM users" },
      {
        sql: "DELETE FROM sqlite_sequence WHERE name = ?",
        params: ["users"],
        ignoreError: true,
      },
    ]);
    expect(adapter.appendReturning("UPDATE users SET name = ?", "*")).toBe(
      "UPDATE users SET name = ? RETURNING *",
    );
  });
});

describe("SQLite 语句缓存", () => {
  const adapter = new SQLiteAdapter();

  afterEach(async () => {
    await adapter.close();
  });

  afterAll(async () => {
    await adapter.close();
  });

  it("相同 SQL 复用 prepare 结果，close 时释放", async () => {
    await adapter.connect({
      adapter: "sqlite",
      connection: { filename: ":memory:" },
    });
    await adapter.execute(
      "CREATE TABLE cache_demo (id INTEGER PRIMARY KEY, name TEXT)",
    );
    await adapter.execute("INSERT INTO cache_demo (name) VALUES (?)", ["a"]);
    expect(adapter.getPreparedStatementCount()).toBeGreaterThanOrEqual(1);

    const sql = "SELECT name FROM cache_demo WHERE name = ?";
    const before = adapter.getPreparedStatementCount();
    await adapter.query(sql, ["a"]);
    const afterFirst = adapter.getPreparedStatementCount();
    expect(afterFirst).toBe(before + 1);
    await adapter.query(sql, ["a"]);
    expect(adapter.getPreparedStatementCount()).toBe(afterFirst);

    await adapter.close();
    expect(adapter.getPreparedStatementCount()).toBe(0);
    expect(adapter.isConnected()).toBe(false);
  });
});
