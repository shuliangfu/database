/**
 * @fileoverview 连接池耗尽测试
 * 测试连接池在达到最大连接数时的行为
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { MySQLAdapter } from "../../src/adapters/mysql.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("连接池耗尽测试", () => {
  let adapter: MySQLAdapter;

  beforeAll(async () => {
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    adapter = new MySQLAdapter();
    await adapter.connect({
      type: "mysql",
      connection: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDatabase,
        username: mysqlUser,
        password: mysqlPassword,
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
      console.log("MySQL not available, skipping test");
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
      console.log("MySQL not available, skipping test");
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
