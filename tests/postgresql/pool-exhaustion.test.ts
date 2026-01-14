/**
 * @fileoverview 连接池耗尽测试
 * 测试连接池在达到最大连接数时的行为
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { PostgreSQLAdapter } from "../../src/adapters/postgresql.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("连接池耗尽测试", () => {
  let adapter: PostgreSQLAdapter;

  beforeAll(async () => {
    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    adapter = new PostgreSQLAdapter();
    await adapter.connect({
      type: "postgresql",
      connection: {
        host: pgHost,
        port: pgPort,
        database: pgDatabase,
        username: pgUser,
        password: pgPassword,
      },
      pool: {
        min: 1,
        max: 2, // 设置较小的最大连接数以便测试
      },
    });
  });

  afterAll(async () => {
    await adapter?.close();
  });

  it("应该在连接池耗尽时正确处理并发请求", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    // 创建多个并发查询，超过最大连接数
    const promises = Array.from(
      { length: 5 },
      () => adapter.query("SELECT 1", []),
    );

    // 所有查询应该都能完成（连接池会排队等待）
    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    results.forEach((result) => {
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该正确报告连接池状态", async () => {
    if (!adapter) {
      console.log("PostgreSQL not available, skipping test");
      return;
    }

    const status = await adapter.getPoolStatus();

    expect(status).toBeTruthy();
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.active).toBeGreaterThanOrEqual(0);
    expect(status.idle).toBeGreaterThanOrEqual(0);
    expect(status.waiting).toBeGreaterThanOrEqual(0);
  }, { sanitizeOps: false, sanitizeResources: false });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
