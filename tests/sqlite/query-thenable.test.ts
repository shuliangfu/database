/**
 * @fileoverview 惰性 thenable：创建构建器不得发查询
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

const TABLE = "test_sqlite_thenable_users";

class User extends SQLModel {
  static override tableName = TABLE;
  static override primaryKey = "id";
}

describe("查询构建器惰性 thenable", () => {
  let adapter: DatabaseAdapter;
  let origQuery: DatabaseAdapter["query"];
  const calls: string[] = [];

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
    if (origQuery) (adapter as any).query = origQuery;
    await closeDatabase();
  });

  beforeEach(async () => {
    if (origQuery) (adapter as any).query = origQuery;
    await adapter.execute(`DELETE FROM ${TABLE}`, []);
    await User.create({ name: "Alice" });
    await User.create({ name: "Bob" });
    calls.length = 0;
    origQuery = adapter.query.bind(adapter);
    (adapter as any).query = async (sql: string, params?: any[]) => {
      calls.push(sql);
      return await origQuery(sql, params);
    };
  });

  it("只链式不 await 不发查询", async () => {
    const builder = User.find({}).sort({ id: "asc" }).limit(10);
    expect(calls.length).toBe(0);
    const builder2 = User.query().where({ name: "Alice" }).fields([
      "id",
      "name",
    ]);
    expect(calls.length).toBe(0);
    // 保持引用，避免被优化掉
    expect(typeof builder.then).toBe("function");
    expect(typeof builder2.then).toBe("function");
  });

  it("await 构建器仍等于 findOne", async () => {
    const user = await User.find({}).sort({ id: "asc" });
    expect(user?.name).toBe("Alice");
    const select = calls.filter((sql) => sql.includes(`FROM ${TABLE}`));
    expect(select.length).toBe(1);
    expect(select[0]).toContain("LIMIT 1");
  });

  it("先 with / findAll 再执行只发该走的列表查询", async () => {
    const users = await User.find({}).sort({ id: "asc" }).findAll();
    expect(users.length).toBe(2);
    const select = calls.filter((sql) => sql.includes(`FROM ${TABLE}`));
    expect(select.length).toBe(1);
    expect(select[0]).not.toContain("LIMIT 1");
  });

  it("await query() 仍等于 findOne，且创建时不发查询", async () => {
    const builder = User.query().where({ name: "Bob" });
    expect(calls.length).toBe(0);
    const user = await builder;
    expect(user?.name).toBe("Bob");
    const select = calls.filter((sql) => sql.includes(`FROM ${TABLE}`));
    expect(select.length).toBe(1);
    expect(select[0]).toContain("LIMIT 1");
  });

  it("asArray().findAll 不会额外触发 findOne", async () => {
    const rows = await User.query().sort({ id: "asc" }).asArray().findAll();
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("Alice");
    const select = calls.filter((sql) => sql.includes(`FROM ${TABLE}`));
    expect(select.length).toBe(1);
    expect(select[0]).not.toContain("LIMIT 1");
  });
}, { sanitizeOps: false, sanitizeResources: false });
