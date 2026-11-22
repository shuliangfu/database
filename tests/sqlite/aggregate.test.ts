/**
 * @fileoverview SQL groupBy / having / aggregate 链式查询
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
import { InvalidSqlIdentifierError } from "../../src/adapters/sql-dialect.ts";
import { InvalidSqlAggregateError } from "../../src/orm/shared/mod.ts";
import { SQLModel } from "../../src/orm/sql-model.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

const TABLE = "test_sqlite_aggregate_orders";

class Order extends SQLModel {
  static override tableName = TABLE;
  static override primaryKey = "id";
}

describe("SQL groupBy / having / aggregate", () => {
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
        status VARCHAR(32) NOT NULL,
        amount INTEGER NOT NULL
      )`,
      [],
    );
    Order.setAdapter(adapter);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await adapter.execute(`DELETE FROM ${TABLE}`, []);
    await Order.create({ status: "paid", amount: 10 });
    await Order.create({ status: "paid", amount: 20 });
    await Order.create({ status: "pending", amount: 5 });
  });

  it("groupBy + aggregate 按组汇总", async () => {
    const rows = await Order.query()
      .groupBy("status")
      .aggregate({ total: "SUM(amount)", n: "COUNT(*)" })
      .sort({ status: "asc" })
      .asArray()
      .findAll();
    expect(rows.length).toBe(2);
    expect(rows[0].status).toBe("paid");
    expect(Number(rows[0].total)).toBe(30);
    expect(Number(rows[0].n)).toBe(2);
    expect(rows[1].status).toBe("pending");
    expect(Number(rows[1].total)).toBe(5);
    expect(Number(rows[1].n)).toBe(1);
  });

  it("having 过滤分组，且参数化", async () => {
    const rows = await Order.query()
      .groupBy("status")
      .aggregate({ n: "COUNT(*)" })
      .having("COUNT(*) > ?", [1])
      .asArray()
      .findAll();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("paid");
    expect(Number(rows[0].n)).toBe(2);
  });

  it("groupBy 后 count 返回组数", async () => {
    expect(await Order.query().groupBy("status").count()).toBe(2);
    expect(
      await Order.query().groupBy("status").having("COUNT(*) > ?", [1]).count(),
    ).toBe(1);
  });

  it("拒绝危险的聚合表达式与分组列", async () => {
    await assertRejects(
      () =>
        Order.query().aggregate({ x: "SUM(amount);DROP TABLE x" }).asArray()
          .findAll(),
      InvalidSqlAggregateError,
    );
    await assertRejects(
      () => Order.query().groupBy("status;drop").asArray().findAll(),
      InvalidSqlIdentifierError,
    );
  });
}, { sanitizeOps: false, sanitizeResources: false });
