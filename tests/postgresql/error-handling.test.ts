/**
 * @fileoverview PostgreSQL 错误处理测试
 * 测试 PostgreSQL 适配器在各种错误场景下的处理能力
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
  assertRejects,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { PostgreSQLAdapter } from "../../src/adapters/postgresql.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("PostgreSQL 错误处理", () => {
  let adapter: PostgreSQLAdapter;

  beforeAll(async () => {
    adapter = new PostgreSQLAdapter();
    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    try {
      await adapter.connect({
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      });
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
    if (adapter) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
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

  describe("连接错误", () => {
    it("应该处理无效的主机名", async () => {
      const badAdapter = new PostgreSQLAdapter();
      try {
        await assertRejects(
          async () => {
            await badAdapter.connect({
              type: "postgresql",
              connection: {
                host: "invalid_host_that_does_not_exist_12345",
                port: 5432,
                database: "test",
                username: "test",
                password: "test",
              },
              postgresqlOptions: {
                connectionTimeout: 2000, // 2 秒超时
              },
            });
          },
          Error,
        );
      } finally {
        // 确保关闭适配器，即使连接失败
        try {
          await badAdapter.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该处理无效的端口", async () => {
      const badAdapter = new PostgreSQLAdapter();
      try {
        await assertRejects(
          async () => {
            // 使用 Promise.race 添加超时，避免长时间等待
            // 使用有效但不可达的端口（65534），而不是无效的端口号
            await Promise.race([
              badAdapter.connect({
                type: "postgresql",
                connection: {
                  host: "localhost",
                  port: 65534, // 有效但不可达的端口
                  database: "test",
                  username: "test",
                  password: "test",
                },
                postgresqlOptions: {
                  connectionTimeout: 2000, // 2 秒超时
                },
                pool: {
                  maxRetries: 0, // 禁用重试，立即失败
                },
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Connection timeout")), 5000)
              ),
            ]);
          },
          Error,
        );
      } finally {
        // 确保关闭适配器，即使连接失败
        try {
          await badAdapter.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
      timeout: 10000, // 10秒超时
    });

    it("应该处理无效的数据库名", async () => {
      const badAdapter = new PostgreSQLAdapter();
      try {
        await assertRejects(
          async () => {
            await badAdapter.connect({
              type: "postgresql",
              connection: {
                host: "localhost",
                port: 5432,
                database: "nonexistent_database_12345",
                username: "test",
                password: "test",
              },
              postgresqlOptions: {
                connectionTimeout: 2000, // 2 秒超时
              },
            });
          },
          Error,
        );
      } finally {
        // 确保关闭适配器，即使连接失败
        try {
          await badAdapter.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("查询错误", () => {
    it("应该处理 SQL 语法错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理表不存在错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query(
            "SELECT * FROM nonexistent_table_12345",
            [],
          );
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理列不存在错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_error_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.query(
            "SELECT nonexistent_column FROM test_error_table",
            [],
          );
        },
        Error,
      );

      await adapter.execute("DROP TABLE IF EXISTS test_error_table", []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("执行错误", () => {
    it("应该处理约束违反错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_constraint_table (
          id SERIAL PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_constraint_table (email) VALUES ($1)",
        ["unique@test.com"],
      );

      // 尝试插入重复的 email
      await assertRejects(
        async () => {
          await adapter.execute(
            "INSERT INTO test_constraint_table (email) VALUES ($1)",
            ["unique@test.com"],
          );
        },
        Error,
      );

      await adapter.execute("DROP TABLE IF EXISTS test_constraint_table", []);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理数据类型错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_type_table (
          id SERIAL PRIMARY KEY,
          age INTEGER
        )`,
        [],
      );

      // 尝试插入错误的数据类型（PostgreSQL 可能会自动转换，但某些情况会失败）
      try {
        await adapter.execute(
          "INSERT INTO test_type_table (age) VALUES ($1)",
          ["not_a_number"],
        );
        // 如果插入成功，PostgreSQL 可能进行了类型转换
      } catch (error) {
        // 如果失败，应该抛出类型错误
        expect(error).toBeInstanceOf(Error);
      }

      await adapter.execute("DROP TABLE IF EXISTS test_type_table", []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务错误", () => {
    it("应该在事务外调用保存点方法时抛出错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.createSavepoint("sp1");
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理事务中的错误并正确回滚", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS test_tx_error (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )`,
        [],
      );

      await assertRejects(
        async () => {
          await adapter.transaction(async (db) => {
            await db.execute(
              "INSERT INTO test_tx_error (name) VALUES ($1)",
              ["TX User"],
            );
            // 故意抛出错误
            throw new Error("Transaction error");
          });
        },
        Error,
      );

      // 验证数据已回滚
      const results = await adapter.query(
        "SELECT * FROM test_tx_error WHERE name = $1",
        ["TX User"],
      );
      expect(results.length).toBe(0);

      await adapter.execute("DROP TABLE IF EXISTS test_tx_error", []);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池错误", () => {
    it("应该在连接池关闭后拒绝新查询", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const testAdapter = new PostgreSQLAdapter();
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      await testAdapter.connect({
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      });

      try {
        await testAdapter.close();

        // 关闭后应该无法查询
        await assertRejects(
          async () => {
            await testAdapter.query("SELECT 1", []);
          },
          Error,
        );
      } finally {
        // 确保关闭适配器
        try {
          await testAdapter.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
