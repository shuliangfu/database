/**
 * @fileoverview MongoDB 时区配置测试
 * 验证 mongoOptions.timezone 配置后，查询结果中 date 字段自动格式化为指定时区字符串
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
import { MongoModel } from "../../src/orm/mongo-model.ts";
import type { DatabaseAdapter, MongoConfig } from "../../src/types.ts";
import { createMongoConfig } from "./mongo-test-utils.ts";

const COLLECTION_TIMEZONE = "mongo_timezone_test";

/**
 * 带 date 字段的模型，用于时区格式化测试
 */
class EventWithDate extends MongoModel {
  static override collectionName = COLLECTION_TIMEZONE;
  static override primaryKey = "_id";
  static override schema = {
    name: { type: "string" as const },
    /** 事件时间，用于验证时区转换 */
    eventAt: { type: "date" as const },
  };
}

describe("MongoDB timezone (mongoOptions.timezone)", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      const config = createMongoConfig({
        database: "test",
        mongoOptions: {
          timezone: "Asia/Shanghai",
          serverSelectionTimeoutMS: 5000,
        },
      });
      await initDatabase(config);
      adapter = getDatabase();
      const db = (adapter as {
        getDatabase?: () => {
          collection: (
            n: string,
          ) => { deleteMany: (filter?: object) => Promise<unknown> };
        };
      })?.getDatabase?.();
      if (db) {
        await db.collection(COLLECTION_TIMEZONE).deleteMany({});
      }
      EventWithDate.setAdapter(adapter);
    } catch (error) {
      console.log("MongoDB not available, skipping timezone tests");
      console.error(error);
    }
  });

  afterAll(async () => {
    try {
      await closeDatabase();
    } catch {
      // 忽略
    }
  });

  beforeEach(async () => {
    if (!adapter) return;
    const db = (adapter as {
      getDatabase?: () => {
        collection: (
          n: string,
        ) => { deleteMany: (filter?: object) => Promise<unknown> };
      };
    })?.getDatabase?.();
    if (db) {
      await db.collection(COLLECTION_TIMEZONE).deleteMany({});
    }
  });

  it("适配器 getTimezone() 应返回配置的时区", () => {
    if (!adapter) return;
    const tz = (adapter as { getTimezone?: () => string }).getTimezone?.();
    expect(tz).toBe("Asia/Shanghai");
  });

  it("查询结果中 date 字段应格式化为配置时区的本地时间字符串", async () => {
    if (!adapter) return;
    // UTC 2024-01-02 04:00:00 → 东八区 2024-01-02 12:00:00
    const utcDate = new Date("2024-01-02T04:00:00.000Z");
    const created = await EventWithDate.create({
      name: "event1",
      eventAt: utcDate,
    });
    expect(created._id).toBeTruthy();

    const found = await EventWithDate.find(created._id);
    expect(found).toBeTruthy();
    expect(found!.name).toBe("event1");
    // 配置了 timezone 后，date 字段应被格式化为字符串（东八区 12:00:00）
    expect(typeof found!.eventAt).toBe("string");
    expect((found!.eventAt as string).includes("12:00:00")).toBe(true);
    expect((found!.eventAt as string).includes("2024")).toBe(true);
  });

  it("findAll 返回的 date 字段也应为时区格式化字符串", async () => {
    if (!adapter) return;
    await EventWithDate.create({
      name: "a",
      eventAt: new Date("2024-06-15T08:00:00.000Z"),
    });
    const list = await EventWithDate.findAll();
    expect(list.length).toBe(1);
    expect(typeof list[0].eventAt).toBe("string");
    // UTC 08:00 → 东八区 16:00
    expect((list[0].eventAt as string).includes("16:00:00")).toBe(true);
  });

  it("PRC 时区与 Asia/Shanghai 等价，应得到东八区时间", async () => {
    try {
      await closeDatabase();
    } catch {
      // 忽略
    }
    const configWithPRC = createMongoConfig({
      database: "test",
      mongoOptions: {
        timezone: "PRC",
        serverSelectionTimeoutMS: 5000,
      },
    }) as MongoConfig;
    await initDatabase(configWithPRC);
    const adp = getDatabase();
    EventWithDate.setAdapter(adp);
    const db = (adp as {
      getDatabase?: () => {
        collection: (
          n: string,
        ) => { deleteMany: (filter?: object) => Promise<unknown> };
      };
    })?.getDatabase?.();
    if (db) {
      await db.collection(COLLECTION_TIMEZONE).deleteMany({});
    }

    const tz = (adp as { getTimezone?: () => string }).getTimezone?.();
    expect(tz).toBe("PRC");

    const created = await EventWithDate.create({
      name: "prc-event",
      eventAt: new Date("2024-01-02T04:00:00.000Z"),
    });
    const found = await EventWithDate.find(created._id);
    expect(found).toBeTruthy();
    expect(typeof found!.eventAt).toBe("string");
    expect((found!.eventAt as string).includes("12:00:00")).toBe(true);

    await closeDatabase();
    // 恢复默认连接供后续用例（若还有）使用
    await initDatabase(
      createMongoConfig({
        database: "test",
        mongoOptions: { serverSelectionTimeoutMS: 5000 },
      }),
    );
    EventWithDate.setAdapter(getDatabase());
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
