/**
 * @fileoverview 标识符注入、原型污染、日志脱敏与 Mongo 操作符收紧
 */

import {
  afterAll,
  assertRejects,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { InvalidSqlIdentifierError } from "../../src/adapters/sql-dialect.ts";
import { QueryLogger } from "../../src/logger/query-logger.ts";
import { redactSensitiveText, redactValue } from "../../src/logger/redact.ts";
import { SQLStatementBuilder } from "../../src/query/sql-builder.ts";
import {
  assertSafeMongoValue,
  assignData,
  UnsafeMongoFieldError,
  UnsafeMongoOperatorError,
} from "../../src/orm/shared/mod.ts";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";

describe("安全：SQL 标识符", () => {
  const adapter = new SQLiteAdapter();

  it("语句构建器拒绝危险表名和列名", () => {
    const builder = new SQLStatementBuilder(adapter);
    expect(() => builder.from("users;drop table x")).toThrow(
      InvalidSqlIdentifierError,
    );
    expect(() =>
      new SQLStatementBuilder(adapter).select(["id;drop"]).from("users")
    ).toThrow(InvalidSqlIdentifierError);
    expect(() =>
      new SQLStatementBuilder(adapter).select(["*"]).from("users").orderBy(
        "id desc;drop",
      )
    ).toThrow(InvalidSqlIdentifierError);
    expect(() =>
      new SQLStatementBuilder(adapter).insert("users", { "name;x": "a" })
    ).toThrow(InvalidSqlIdentifierError);
  });

  it("拒绝非法 JOIN 类型，合法表名仍可构建", () => {
    const builder = new SQLStatementBuilder(adapter);
    expect(() =>
      builder.from("users").join(
        "posts",
        "users.id = posts.user_id",
        "INNER;DROP",
      )
    )
      .toThrow(/Invalid JOIN type/);
    const ok = new SQLStatementBuilder(adapter)
      .select(["id", "name"])
      .from("users")
      .orderBy("name", "ASC");
    expect(ok.toSQL()).toContain("FROM users");
    expect(ok.toSQL()).toContain("ORDER BY name ASC");
  });
});

describe("安全：原型污染", () => {
  it("assignData 丢弃 __proto__ / constructor / prototype", () => {
    const target: Record<string, unknown> = { name: "ok" };
    const payload = JSON.parse(
      '{"name":"evil","__proto__":{"polluted":true},"constructor":{"x":1},"prototype":{"y":1}}',
    );
    assignData(target, payload);
    expect(target.name).toBe("evil");
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(Object.hasOwn(target, "__proto__")).toBe(false);
    expect(Object.hasOwn(target, "constructor")).toBe(false);
    expect(Object.hasOwn(target, "prototype")).toBe(false);
  });
});

describe("安全：查询日志脱敏", () => {
  it("抹掉参数里的密码和连接串中的凭据", () => {
    const logger = new QueryLogger({ enabled: true, logLevel: "all" });
    logger.log(
      "query",
      "INSERT INTO users (email, password) VALUES (?, ?)",
      ["a@b.com", "super-secret"],
      3,
    );
    const logs = logger.getLogs();
    // 列名 password 不是连接串，SQL 文本本身可保留；参数对象里的 password 键需脱敏
    logger.clear();

    logger.log(
      "query",
      "connect mongodb://root:hunter2@localhost:27017/test",
      [{ password: "hunter2", user: "root" }],
      1,
    );
    const entry = logger.getLogs()[0];
    expect(entry.sql).toContain("[Redacted]");
    expect(entry.sql).not.toContain("hunter2");
    expect(entry.params?.[0]).toEqual({
      password: "[Redacted]",
      user: "root",
    });
  });

  it("redactSensitiveText 处理 URI 凭据", () => {
    expect(
      redactSensitiveText("failed: mongodb://u:s3cret@localhost/db"),
    ).toBe("failed: mongodb://u:[Redacted]@localhost/db");
    expect(redactValue({ token: "abc", ok: 1 })).toEqual({
      token: "[Redacted]",
      ok: 1,
    });
  });
});

describe("安全：Mongo 操作符", () => {
  it("拒绝 $where / $function 以及污染键，允许 $gt / $in", () => {
    expect(() => assertSafeMongoValue({ $where: "this.a == 1" })).toThrow(
      UnsafeMongoOperatorError,
    );
    expect(() => assertSafeMongoValue({ age: { $function: "function(){}" } }))
      .toThrow(UnsafeMongoOperatorError);
    expect(() => assertSafeMongoValue(JSON.parse('{"__proto__":{"x":1}}')))
      .toThrow(UnsafeMongoFieldError);
    expect(() =>
      assertSafeMongoValue({ age: { $gt: 18 }, name: { $in: ["a"] } })
    ).not.toThrow();
  });
});

const TABLE = "test_sqlite_security_users";

class User extends SQLModel {
  static override tableName = TABLE;
  static override primaryKey = "id";
}

describe("安全：模型条件与写入", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    await initDatabase({
      adapter: "sqlite",
      connection: { filename: ":memory:" },
    });
    adapter = getDatabase();
    await adapter.execute(`DROP TABLE IF EXISTS ${TABLE}`, []).catch(() => {});
    await adapter.execute(
      `CREATE TABLE ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL
      )`,
      [],
    );
    User.setAdapter(adapter);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await adapter.execute(`DELETE FROM ${TABLE}`, []);
  });

  it("拒绝条件与排序中的注入型标识符", async () => {
    await assertRejects(
      async () => {
        await User.find({ "id;drop": 1 } as any);
      },
      InvalidSqlIdentifierError,
    );
    await assertRejects(
      () => User.find({}).sort({ "name desc;drop": "asc" } as any).findAll(),
      InvalidSqlIdentifierError,
    );
  });

  it("create 丢弃 __proto__ 等污染键", async () => {
    const payload = JSON.parse(
      '{"name":"Safe","__proto__":{"pollutedDb":true}}',
    );
    const user = await User.create(payload);
    expect(user.name).toBe("Safe");
    expect((Object.prototype as any).pollutedDb).toBeUndefined();
    expect(Object.hasOwn(user, "__proto__")).toBe(false);
  });
}, { sanitizeOps: false, sanitizeResources: false });
