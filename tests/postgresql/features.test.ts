/**
 * @fileoverview PostgreSQL 特有功能测试
 * 测试 PostgreSQL 特有的数据类型和功能：JSON、ARRAY、UUID、RETURNING 子句等
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("PostgreSQL 特有功能", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    // 在 Bun 测试环境中，先清理所有之前的连接，避免连接累积
    // Bun 可能并行运行测试文件，导致连接泄漏
    try {
      await closeDatabase();
    } catch {
      // 忽略清理错误
    }

    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = "testuser";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "testpass");

    try {
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
    } catch (error) {
      console.warn(
        `PostgreSQL not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
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

  beforeEach(async () => {
    if (!adapter) return;

    // 清理测试表
    try {
      await adapter.execute("DROP TABLE IF EXISTS test_json_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_array_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_uuid_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_returning_data", []);
    } catch {
      // 忽略错误
    }
  });

  describe("JSON 数据类型", () => {
    it("应该支持 JSON 类型插入和查询", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_json_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          data JSON
        )`,
        [],
      );

      const jsonData = { key: "value", number: 123, nested: { foo: "bar" } };

      await adapter.execute(
        "INSERT INTO test_json_data (name, data) VALUES ($1, $2)",
        ["JSON User", JSON.stringify(jsonData)],
      );

      const results = await adapter.query(
        "SELECT * FROM test_json_data WHERE name = $1",
        ["JSON User"],
      );

      expect(results.length).toBe(1);
      expect(typeof results[0].data).toBe("object");
      expect(results[0].data.key).toBe("value");
      expect(results[0].data.number).toBe(123);
      expect(results[0].data.nested.foo).toBe("bar");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 JSONB 类型", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_json_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          data JSONB
        )`,
        [],
      );

      const jsonData = { key: "value", array: [1, 2, 3] };

      await adapter.execute(
        "INSERT INTO test_json_data (name, data) VALUES ($1, $2)",
        ["JSONB User", JSON.stringify(jsonData)],
      );

      // 使用 JSONB 操作符查询
      const results = await adapter.query(
        "SELECT * FROM test_json_data WHERE data->>'key' = $1",
        ["value"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("JSONB User");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("ARRAY 数据类型", () => {
    it("应该支持整数数组", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_array_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          numbers INTEGER[]
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_array_data (name, numbers) VALUES ($1, $2)",
        ["Array User", [1, 2, 3, 4, 5]],
      );

      const results = await adapter.query(
        "SELECT * FROM test_array_data WHERE name = $1",
        ["Array User"],
      );

      expect(results.length).toBe(1);
      expect(Array.isArray(results[0].numbers)).toBe(true);
      expect(results[0].numbers).toEqual([1, 2, 3, 4, 5]);
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该支持字符串数组", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_array_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          tags TEXT[]
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_array_data (name, tags) VALUES ($1, $2)",
        ["Tags User", ["tag1", "tag2", "tag3"]],
      );

      const results = await adapter.query(
        "SELECT * FROM test_array_data WHERE name = $1",
        ["Tags User"],
      );

      expect(results.length).toBe(1);
      expect(Array.isArray(results[0].tags)).toBe(true);
      expect(results[0].tags).toEqual(["tag1", "tag2", "tag3"]);
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该支持数组查询操作符", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_array_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          tags TEXT[]
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_array_data (name, tags) VALUES ($1, $2), ($3, $4)",
        ["User 1", ["tag1", "tag2"], "User 2", ["tag2", "tag3"]],
      );

      // 使用 @> 操作符查询包含特定元素的数组
      const results = await adapter.query(
        "SELECT * FROM test_array_data WHERE tags @> $1",
        [["tag1"]],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("User 1");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("UUID 数据类型", () => {
    it("应该支持 UUID 类型", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      // 确保 uuid 扩展已启用
      try {
        await adapter.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"', []);
      } catch {
        // 扩展可能已存在或没有权限，忽略
      }

      await adapter.execute(
        `CREATE TABLE test_uuid_data (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100)
        )`,
        [],
      );

      const uuid = "550e8400-e29b-41d4-a716-446655440000";

      await adapter.execute(
        "INSERT INTO test_uuid_data (id, name) VALUES ($1, $2)",
        [uuid, "UUID User"],
      );

      const results = await adapter.query(
        "SELECT * FROM test_uuid_data WHERE name = $1",
        ["UUID User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(uuid);
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该支持 UUID 自动生成", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      try {
        await adapter.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"', []);
      } catch {
        // 扩展可能已存在或没有权限，忽略
      }

      await adapter.execute(
        `CREATE TABLE test_uuid_data (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100)
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_uuid_data (name) VALUES ($1)",
        ["Auto UUID User"],
      );

      const results = await adapter.query(
        "SELECT * FROM test_uuid_data WHERE name = $1",
        ["Auto UUID User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBeTruthy();
      expect(typeof results[0].id).toBe("string");
      // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(results[0].id.length).toBe(36);
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("RETURNING 子句", () => {
    it("应该在 INSERT 中使用 RETURNING 子句", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_returning_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          age INTEGER
        )`,
        [],
      );

      const result = await adapter.execute(
        "INSERT INTO test_returning_data (name, email, age) VALUES ($1, $2, $3) RETURNING id, name, email",
        ["Returning User", "returning@test.com", 25],
      );

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe("Returning User");
      expect(result.rows[0].email).toBe("returning@test.com");
      expect(result.rows[0].id).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该在 UPDATE 中使用 RETURNING 子句", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_returning_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_returning_data (name, email, age) VALUES ($1, $2, $3)",
        ["Update Returning User", "update_returning@test.com", 25],
      );

      const result = await adapter.execute(
        "UPDATE test_returning_data SET age = $1 WHERE email = $2 RETURNING id, name, age",
        [30, "update_returning@test.com"],
      );

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].age).toBe(30);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在 DELETE 中使用 RETURNING 子句", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_returning_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          age INTEGER
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_returning_data (name, email, age) VALUES ($1, $2, $3)",
        ["Delete Returning User", "delete_returning@test.com", 25],
      );

      const result = await adapter.execute(
        "DELETE FROM test_returning_data WHERE email = $1 RETURNING id, name, email",
        ["delete_returning@test.com"],
      );

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe("Delete Returning User");
      expect(result.rows[0].email).toBe("delete_returning@test.com");
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
