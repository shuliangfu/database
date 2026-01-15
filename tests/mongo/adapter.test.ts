/**
 * @fileoverview MongoDBAdapter 基础功能测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterAll,
  assertRejects,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import { QueryLogger } from "../../src/logger/query-logger.ts";
import type { DatabaseAdapter, DatabaseConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("MongoDBAdapter", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
    const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
    const mongoDatabase = getEnvWithDefault(
      "MONGODB_DATABASE",
      "test_mongodb_adapter",
    );
    const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
    const directConnection = getEnvWithDefault(
      "MONGODB_DIRECT_CONNECTION",
      "true",
    ) === "true";

    try {
      // 直接创建适配器实例进行测试
      adapter = new MongoDBAdapter();
      await adapter.connect({
        type: "mongodb",
        connection: {
          host: mongoHost,
          port: mongoPort,
          database: mongoDatabase,
        },
        mongoOptions: {
          replicaSet: replicaSet, // 从环境变量获取副本集名称
          directConnection: directConnection,
        },
      });
    } catch (error) {
      console.warn(
        `MongoDB not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    if (adapter) {
      try {
        const db = (adapter as any).getDatabase();
        if (db) {
          await db.collection("adapter_test_users").deleteMany({});
        }
      } catch {
        // 忽略错误
      }
      // 直接关闭适配器连接
      if (adapter.isConnected()) {
        try {
          await adapter.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    // 清理测试数据
    const db = (adapter as any).db;
    if (db) {
      await db.collection("adapter_test_users").deleteMany({});
    }
  });

  describe("connect", () => {
    it("应该连接到 MongoDB 数据库", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      expect(adapter.isConnected()).toBe(true);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在连接失败时抛出错误", async () => {
      const invalidAdapter = new MongoDBAdapter();
      await assertRejects(
        async () => {
          await invalidAdapter.connect({
            type: "mongodb",
            connection: {
              host: "invalid_host",
              port: 27017,
              database: "invalid_db",
            },
            mongoOptions: {
              maxRetries: 0, // 禁用重试，快速失败
              retryDelay: 100,
              timeoutMS: 1000, // 1秒超时
            },
          });
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("query", () => {
    it("应该执行查询并返回结果", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入测试数据
      await adapter.execute("insert", "adapter_test_users", {
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      });

      const results = await adapter.query("adapter_test_users", {
        name: "Alice",
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
      expect(results[0].email).toBe("alice@example.com");
      expect(results[0].age).toBe(25);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持查询选项", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入多条数据
      await adapter.execute("insert", "adapter_test_users", {
        name: "Bob",
        age: 30,
      });
      await adapter.execute("insert", "adapter_test_users", {
        name: "Charlie",
        age: 35,
      });

      const results = await adapter.query(
        "adapter_test_users",
        { age: { $gt: 25 } },
        { sort: { age: 1 } },
      );

      expect(results.length).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在查询空集合时返回空数组", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const results = await adapter.query("adapter_test_users", {});

      expect(results).toEqual([]);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("execute", () => {
    it("应该执行插入操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const result = await adapter.execute("insert", "adapter_test_users", {
        name: "David",
        email: "david@example.com",
        age: 40,
      });

      expect(result).toBeTruthy();
      expect(result.insertedId).toBeTruthy();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行批量插入操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const result = await adapter.execute("insertMany", "adapter_test_users", [
        { name: "Eve", age: 28 },
        { name: "Frank", age: 32 },
      ]);

      expect(result).toBeTruthy();
      expect(result.insertedCount).toBe(2);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行更新操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入数据
      const insertResult = await adapter.execute("insert", "adapter_test_users", {
        name: "Grace",
        age: 30,
      });

      const result = await adapter.execute("update", "adapter_test_users", {
        filter: { _id: insertResult.insertedId },
        update: { $set: { age: 35 } },
      });

      expect(result).toBeTruthy();
      expect(result.modifiedCount).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行批量更新操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入数据
      await adapter.execute("insertMany", "adapter_test_users", [
        { name: "Henry", age: 25 },
        { name: "Ivy", age: 25 },
      ]);

      const result = await adapter.execute("updateMany", "adapter_test_users", {
        filter: { age: 25 },
        update: { $set: { age: 26 } },
      });

      expect(result).toBeTruthy();
      expect(result.modifiedCount).toBe(2);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行删除操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入数据
      const insertResult = await adapter.execute("insert", "adapter_test_users", {
        name: "Jack",
        age: 30,
      });

      const result = await adapter.execute("delete", "adapter_test_users", {
        filter: { _id: insertResult.insertedId },
      });

      expect(result).toBeTruthy();
      expect(result.deletedCount).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行批量删除操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 先插入数据
      await adapter.execute("insertMany", "adapter_test_users", [
        { name: "Kate", age: 30 },
        { name: "Leo", age: 30 },
      ]);

      const result = await adapter.execute("deleteMany", "adapter_test_users", {
        filter: { age: 30 },
      });

      expect(result).toBeTruthy();
      expect(result.deletedCount).toBe(2);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在缺少 collection 参数时抛出错误", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("insert", [] as any, { name: "Test" });
        },
        Error,
        "collection name",
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在缺少 data 参数时抛出错误", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("insert", "adapter_test_users", undefined as any);
        },
        Error,
        "data",
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("getPoolStatus", () => {
    it("应该返回连接池状态", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const status = await adapter.getPoolStatus();

      expect(status).toBeTruthy();
      expect(status.total).toBeGreaterThanOrEqual(0); // MongoDB 连接池可能为 0
      expect(status.active).toBeGreaterThanOrEqual(0);
      expect(status.idle).toBeGreaterThanOrEqual(0);
      expect(status.waiting).toBeGreaterThanOrEqual(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("healthCheck", () => {
    it("应该执行健康检查", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const result = await adapter.healthCheck();

      expect(result).toBeTruthy();
      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在连接正常时返回健康状态", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.error).toBeUndefined();
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("close", () => {
    it("应该关闭数据库连接", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const testAdapter = new MongoDBAdapter();
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      try {
        await testAdapter.connect({
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: "test_close",
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: directConnection,
          },
        });

        expect(testAdapter.isConnected()).toBe(true);

        await testAdapter.close();

        expect(testAdapter.isConnected()).toBe(false);
      } catch {
        // MongoDB 不可用，跳过
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该可以多次调用 close 而不出错", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const testAdapter = new MongoDBAdapter();
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
      const directConnection = getEnvWithDefault(
        "MONGODB_DIRECT_CONNECTION",
        "true",
      ) === "true";

      try {
        await testAdapter.connect({
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: "test_close",
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: directConnection,
          },
        });

        await testAdapter.close();
        await testAdapter.close(); // 第二次调用不应该出错
      } catch {
        // MongoDB 不可用，跳过
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("transaction", () => {
    it("应该执行事务并提交", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).db;
      if (db) {
        await db.collection("adapter_test_users").deleteMany({});
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute("insert", "adapter_test_users", {
          name: "Transaction User 1",
          email: "trans1@test.com",
          age: 25,
        });
        await db.execute("insert", "adapter_test_users", {
          name: "Transaction User 2",
          email: "trans2@test.com",
          age: 30,
        });
      });

      const users = await adapter.query("adapter_test_users", {
        email: { $in: ["trans1@test.com", "trans2@test.com"] },
      });
      expect(users.length).toBe(2);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).db;
      if (db) {
        await db.collection("adapter_test_users").deleteMany({});
      }

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.execute("insert", "adapter_test_users", {
              name: "Transaction User",
              email: "trans@test.com",
              age: 25,
            });
            // 故意触发错误
            throw new Error("Transaction error");
          });
        },
        Error,
      );

      const users = await adapter.query("adapter_test_users", {
        email: "trans@test.com",
      });
      expect(users.length).toBe(0); // 事务应该回滚，没有数据
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("savepoints", () => {
    it("应该不支持保存点（MongoDB 不支持）", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.createSavepoint("sp1");
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("query logger", () => {
    it("应该支持设置和获取查询日志记录器", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const { QueryLogger } = await import("../../src/logger/query-logger.ts");
      const logger = new QueryLogger();

      adapter.setQueryLogger(logger);
      expect(adapter.getQueryLogger()).toBe(logger);

      // 执行一个查询，验证日志记录
      await adapter.query("adapter_test_users", {});

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].type).toBe("query");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("BaseAdapter 辅助方法", () => {
    describe("getLastHealthCheck", () => {
      it("应该在初始状态下返回 null", () => {
        const newAdapter = new MongoDBAdapter();
        expect(newAdapter.getLastHealthCheck()).toBeNull();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该在健康检查后返回时间", async () => {
        const newAdapter = new MongoDBAdapter();
        const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
        const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
        const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
        const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
        const directConnection = getEnvWithDefault(
          "MONGODB_DIRECT_CONNECTION",
          "true",
        ) === "true";

        const config: DatabaseConfig = {
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: mongoDatabase,
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: directConnection,
          },
        };
        await newAdapter.connect(config);

        const before = new Date();
        await newAdapter.healthCheck();
        const after = new Date();

        const lastCheck = newAdapter.getLastHealthCheck();
        expect(lastCheck).toBeTruthy();
        expect(lastCheck).toBeInstanceOf(Date);
        if (lastCheck) {
          expect(lastCheck.getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(lastCheck.getTime()).toBeLessThanOrEqual(after.getTime());
        }

        await newAdapter.close();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("setHealthCheckInterval", () => {
      it("应该设置健康检查间隔", () => {
        const newAdapter = new MongoDBAdapter();
        newAdapter.setHealthCheckInterval(60000);

        expect(newAdapter).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持不同的间隔值", () => {
        const newAdapter = new MongoDBAdapter();
        newAdapter.setHealthCheckInterval(1000);
        newAdapter.setHealthCheckInterval(5000);
        newAdapter.setHealthCheckInterval(30000);

        expect(newAdapter).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("setQueryLogger", () => {
      it("应该设置查询日志记录器", () => {
        const logger = new QueryLogger();
        (adapter as any).setQueryLogger(logger);

        const retrievedLogger = (adapter as any).getQueryLogger();
        expect(retrievedLogger).toBe(logger);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持替换日志记录器", () => {
        const logger1 = new QueryLogger();
        const logger2 = new QueryLogger();

        (adapter as any).setQueryLogger(logger1);
        expect((adapter as any).getQueryLogger()).toBe(logger1);

        (adapter as any).setQueryLogger(logger2);
        expect((adapter as any).getQueryLogger()).toBe(logger2);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持设置为 null", () => {
        const logger = new QueryLogger();
        (adapter as any).setQueryLogger(logger);
        expect((adapter as any).getQueryLogger()).toBe(logger);

        const newAdapter = new MongoDBAdapter();
        expect(newAdapter.getQueryLogger()).toBeNull();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("getQueryLogger", () => {
      it("应该在未设置时返回 null", async () => {
        const newAdapter = new MongoDBAdapter();
        const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
        const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
        const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
        const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
        const directConnection = getEnvWithDefault(
          "MONGODB_DIRECT_CONNECTION",
          "true",
        ) === "true";

        const config: DatabaseConfig = {
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: mongoDatabase,
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: directConnection,
          },
        };
        await newAdapter.connect(config);

        expect(newAdapter.getQueryLogger()).toBeNull();

        await newAdapter.close();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该返回设置的日志记录器", () => {
        const logger = new QueryLogger({
          enabled: true,
          logLevel: "all",
        });

        (adapter as any).setQueryLogger(logger);
        const retrievedLogger = (adapter as any).getQueryLogger();

        expect(retrievedLogger).toBe(logger);
        expect(retrievedLogger?.getLogger()).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("isConnected", () => {
      it("应该在连接后返回 true", () => {
        expect(adapter.isConnected()).toBe(true);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该在未连接时返回 false", async () => {
        const newAdapter = new MongoDBAdapter();
        expect(newAdapter.isConnected()).toBe(false);

        const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
        const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
        const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
        const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
        const directConnection = getEnvWithDefault(
          "MONGODB_DIRECT_CONNECTION",
          "true",
        ) === "true";

        const config: DatabaseConfig = {
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: mongoDatabase,
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: directConnection,
          },
        };
        await newAdapter.connect(config);
        expect(newAdapter.isConnected()).toBe(true);

        await newAdapter.close();
        expect(newAdapter.isConnected()).toBe(false);
      }, { sanitizeOps: false, sanitizeResources: false });
    });
  });

  describe("getDatabase", () => {
    it("应该返回数据库实例", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const db = (adapter as any).getDatabase();
      expect(db).toBeTruthy();
      expect(db?.databaseName).toBeTruthy();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在未连接时返回 null", () => {
      const newAdapter = new MongoDBAdapter();
      const db = newAdapter.getDatabase();
      expect(db).toBeNull();
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("事务适配器", () => {
    it("应该在事务适配器中执行查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute("insert", "adapter_test_users", {
          name: "Transaction User",
          email: "tx@test.com",
          age: 25,
        });

        const users = await db.query("adapter_test_users", { email: "tx@test.com" });
        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Transaction User");
      });

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {
        email: "tx@test.com",
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中执行更新", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute("insert", "adapter_test_users", {
          name: "Update User",
          email: "update@test.com",
          age: 25,
        });

        const result = await db.execute("update", "adapter_test_users", {
          filter: { email: "update@test.com" },
          update: { age: 30 },
        });
        expect(result.modifiedCount).toBe(1);

        const users = await db.query("adapter_test_users", {
          email: "update@test.com",
        });
        expect(users[0].age).toBe(30);
      });

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {
        email: "update@test.com",
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中获取连接池状态", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const status = await db.getPoolStatus();
        expect(status).toBeTruthy();
        expect(typeof status.total).toBe("number");
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中执行健康检查", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const health = await db.healthCheck();
        expect(health.healthy).toBe(true);
        expect(health.latency).toBeGreaterThanOrEqual(0);
      });
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("复杂查询", () => {
    it("应该支持聚合管道查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insertMany", "adapter_test_users", [
        { name: "User 1", age: 20, city: "Beijing" },
        { name: "User 2", age: 30, city: "Shanghai" },
        { name: "User 3", age: 40, city: "Beijing" },
      ]);

      // 使用聚合管道
      const results = await adapter.query("adapter_test_users", {}, {
        pipeline: [
          { $match: { city: "Beijing" } },
          {
            $group: {
              _id: "$city",
              avgAge: { $avg: "$age" },
              count: { $sum: 1 },
            },
          },
        ],
      });

      expect(results.length).toBeGreaterThan(0);

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持查询选项", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insertMany", "adapter_test_users", [
        { name: "User 1", age: 20 },
        { name: "User 2", age: 30 },
        { name: "User 3", age: 40 },
      ]);

      // 使用 limit 和 sort
      const results = await adapter.query("adapter_test_users", {}, {
        limit: 2,
        sort: { age: -1 },
      });

      expect(results.length).toBe(2);
      expect(results[0].age).toBe(40);

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持投影查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insert", "adapter_test_users", {
        name: "Projection User",
        email: "projection@test.com",
        age: 25,
      });

      // 只查询 name 和 age
      const results = await adapter.query("adapter_test_users", {
        email: "projection@test.com",
      }, {
        projection: { name: 1, age: 1, _id: 0 },
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Projection User");
      expect(results[0].age).toBe(25);
      expect(results[0].email).toBeUndefined();

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("更多操作类型", () => {
    it("应该支持 findOneAndUpdate", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      const insertResult = await adapter.execute("insert", "adapter_test_users", {
        name: "FindOne User",
        email: "findone@test.com",
        age: 25,
      });
      expect(insertResult.insertedId).toBeTruthy();

      // 验证数据已插入
      const beforeUpdate = await adapter.query("adapter_test_users", {
        email: "findone@test.com",
      });
      expect(beforeUpdate.length).toBe(1);
      expect(beforeUpdate[0].age).toBe(25);

      // 使用 findOneAndUpdate
      const result = await adapter.execute("findOneAndUpdate", "adapter_test_users", {
        filter: { email: "findone@test.com" },
        update: { $set: { age: 30 } },
        options: { returnDocument: "after" },
      });

      // MongoDB findOneAndUpdate 返回 { value: Document | null }
      // 如果 returnDocument 是 "after"，value 应该是更新后的文档
      // 如果 returnDocument 是 "before" 或未设置，value 是更新前的文档
      expect(result).toBeTruthy();

      // 检查更新是否成功（通过查询验证）
      const afterUpdate = await adapter.query("adapter_test_users", {
        email: "findone@test.com",
      });
      expect(afterUpdate.length).toBe(1);
      expect(afterUpdate[0].age).toBe(30);

      // 如果 result.value 存在，验证它
      if (result.value) {
        expect(result.value.age).toBe(30);
      }

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 findOneAndDelete", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insert", "adapter_test_users", {
        name: "Delete User",
        email: "delete@test.com",
        age: 25,
      });

      // 使用 findOneAndDelete
      const result = await adapter.execute("findOneAndDelete", "adapter_test_users", {
        filter: { email: "delete@test.com" },
      });

      // MongoDB findOneAndDelete 返回 { value: Document | null }
      // 验证已删除（通过查询验证）
      const users = await adapter.query("adapter_test_users", {
        email: "delete@test.com",
      });
      expect(users.length).toBe(0);

      // 如果 result.value 存在，验证它
      if (result.value) {
        expect(result.value.email).toBe("delete@test.com");
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持更新操作符", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insert", "adapter_test_users", {
        name: "Operator User",
        email: "operator@test.com",
        age: 25,
        score: 100,
      });

      // 使用 $inc 操作符
      await adapter.execute("update", "adapter_test_users", {
        filter: { email: "operator@test.com" },
        update: { $inc: { score: 10 } },
      });

      const user = await adapter.query("adapter_test_users", {
        email: "operator@test.com",
      });
      expect(user[0].score).toBe(110);

      // 使用 $set 操作符
      await adapter.execute("update", "adapter_test_users", {
        filter: { email: "operator@test.com" },
        update: { $set: { age: 30 } },
      });

      const user2 = await adapter.query("adapter_test_users", {
        email: "operator@test.com",
      });
      expect(user2[0].age).toBe(30);

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询日志记录", () => {
    it("应该记录查询日志", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      (adapter as any).setQueryLogger(logger);

      await adapter.query("adapter_test_users", {});
      await adapter.query("adapter_test_users", { name: "Test" });

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((log) => log.type === "query")).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录执行日志", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      (adapter as any).setQueryLogger(logger);

      await adapter.execute("insert", "adapter_test_users", {
        name: "Log User",
        email: "log@test.com",
        age: 25,
      });

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some((log) => log.type === "execute")).toBe(true);

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录错误日志", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      (adapter as any).setQueryLogger(logger);

      try {
        await adapter.execute("invalidOperation", "adapter_test_users", {});
      } catch {
        // 忽略错误
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("边界条件", () => {
    it("应该处理空查询条件", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const results = await adapter.query("adapter_test_users", {});
      expect(Array.isArray(results)).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理null值", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.execute("insert", "adapter_test_users", {
        name: "Null User",
        email: null,
        age: null,
      });

      const users = await adapter.query("adapter_test_users", { name: "Null User" });
      expect(users.length).toBe(1);
      expect(users[0].email).toBeNull();
      expect(users[0].age).toBeNull();

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理特殊字符", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const specialName = 'User\'s Name & "Special" <Chars>';
      await adapter.execute("insert", "adapter_test_users", {
        name: specialName,
        email: "special@test.com",
        age: 25,
      });

      const users = await adapter.query("adapter_test_users", {
        email: "special@test.com",
      });
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(specialName);

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理嵌套对象", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.execute("insert", "adapter_test_users", {
        name: "Nested User",
        email: "nested@test.com",
        address: {
          city: "Beijing",
          street: "Main St",
        },
      });

      const users = await adapter.query("adapter_test_users", {
        "address.city": "Beijing",
      });
      expect(users.length).toBe(1);
      expect(users[0].address.city).toBe("Beijing");

      // 清理
      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("错误处理", () => {
    it("应该处理连接配置错误", async () => {
      const badAdapter = new MongoDBAdapter();
      await assertRejects(
        async () => {
          // 使用 Promise.race 添加超时，避免长时间等待
          await Promise.race([
            badAdapter.connect({
              type: "mongodb",
              connection: {
                host: "invalid_host_that_does_not_exist",
                port: 27017,
                database: "invalid_db",
              },
              mongoOptions: {
                timeoutMS: 2000, // 2秒超时
                maxRetries: 0, // 不重试，快速失败
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection timeout")), 5000)
            ),
          ]);
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
      timeout: 10000, // 10秒超时
    });

    it("应该处理缺少必需配置", async () => {
      const badAdapter = new MongoDBAdapter();
      await assertRejects(
        async () => {
          // 使用 Promise.race 添加超时，避免长时间等待
          await Promise.race([
            badAdapter.connect({
              type: "mongodb",
              connection: {
                host: "",
                database: "",
              } as any,
              mongoOptions: {
                timeoutMS: 2000, // 2秒超时
                maxRetries: 0, // 不重试，快速失败
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection timeout")), 5000)
            ),
          ]);
        },
        Error,
      );
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
      timeout: 10000, // 10秒超时
    });

    it("应该处理无效操作类型", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("invalidOperation", "adapter_test_users", {});
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理缺少collection参数", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("insert", undefined as any, {});
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("更多操作类型", () => {
    it("应该支持 findOneAndReplace", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.execute("insert", "adapter_test_users", {
        name: "Replace User",
        email: "replace@test.com",
        age: 25,
      });

      const result = await adapter.execute("findOneAndReplace", "adapter_test_users", {
        filter: { email: "replace@test.com" },
        replacement: {
          name: "Replaced User",
          email: "replace@test.com",
          age: 30,
        },
        options: { returnDocument: "after" },
      });

      // MongoDB findOneAndReplace 返回 { value: Document | null }
      // 验证替换是否成功（通过查询验证）
      const afterReplace = await adapter.query("adapter_test_users", {
        email: "replace@test.com",
      });
      expect(afterReplace.length).toBe(1);
      expect(afterReplace[0].age).toBe(30);
      expect(afterReplace[0].name).toBe("Replaced User");

      // 如果 result.value 存在，验证它
      if (result.value) {
        expect(result.value.age).toBe(30);
      }

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 upsert", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 使用 update 操作符进行 upsert
      const result1 = await adapter.execute("update", "adapter_test_users", {
        filter: { email: "upsert@test.com" },
        update: { $set: { name: "Upsert User", age: 25 } },
        options: { upsert: true },
      });

      expect(result1.upsertedCount || result1.modifiedCount).toBeGreaterThan(0);

      // 再次 upsert 应该更新而不是插入
      const result2 = await adapter.execute("update", "adapter_test_users", {
        filter: { email: "upsert@test.com" },
        update: { $set: { age: 30 } },
        options: { upsert: true },
      });

      const user = await adapter.query("adapter_test_users", {
        email: "upsert@test.com",
      });
      expect(user[0].age).toBe(30);

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持更多更新操作符", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.execute("insert", "adapter_test_users", {
        name: "Operator User",
        email: "operator2@test.com",
        age: 25,
        tags: ["tag1"],
        score: 100,
      });

      // 使用 $push 操作符
      await adapter.execute("update", "adapter_test_users", {
        filter: { email: "operator2@test.com" },
        update: { $push: { tags: "tag2" } },
      });

      // 使用 $unset 操作符
      await adapter.execute("update", "adapter_test_users", {
        filter: { email: "operator2@test.com" },
        update: { $unset: { score: "" } },
      });

      const user = await adapter.query("adapter_test_users", {
        email: "operator2@test.com",
      });
      expect(user[0].tags.length).toBe(2);
      expect(user[0].score).toBeUndefined();

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("副本集配置", () => {
    it("应该支持副本集配置", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 测试副本集配置（如果环境支持）
      const testAdapter = new MongoDBAdapter();
      const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
      const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
      const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
      const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "");

      if (replicaSet) {
        await testAdapter.connect({
          type: "mongodb",
          connection: {
            host: mongoHost,
            port: mongoPort,
            database: mongoDatabase,
          },
          mongoOptions: {
            replicaSet: replicaSet,
            directConnection: false,
          },
        });

        expect(testAdapter.isConnected()).toBe(true);
        await testAdapter.close();
      } else {
        // 如果没有配置副本集，跳过测试
        console.log("Replica set not configured, skipping test");
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("并发操作", () => {
    it("应该支持并发查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute(
        "insertMany",
        "adapter_test_users",
        Array.from(
          { length: 10 },
          (_, i) => ({
            name: `Concurrent User ${i + 1}`,
            email: `concurrent${i + 1}@test.com`,
            age: 20 + i + 1,
          }),
        ),
      );

      // 并发查询
      const promises = Array.from(
        { length: 10 },
        (_, i) =>
          adapter.query("adapter_test_users", {
            email: `concurrent${i + 1}@test.com`,
          }),
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach((result, index) => {
        expect(result.length).toBe(1);
        expect(result[0].email).toBe(`concurrent${index + 1}@test.com`);
      });

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持并发事务", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 并发事务
      const promises = Array.from(
        { length: 5 },
        (_, i) =>
          adapter.transaction(async (db: DatabaseAdapter) => {
            await db.execute("insert", "adapter_test_users", {
              name: `Concurrent TX User ${i}`,
              email: `concurrent_tx${i}@test.com`,
              age: 20 + i,
            });
            return i;
          }),
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);

      const count = await adapter.query("adapter_test_users", {});
      expect(count.length).toBeGreaterThanOrEqual(5);

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询日志详细验证", () => {
    it("应该记录查询的详细信息", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      (adapter as any).setQueryLogger(logger);

      await adapter.query("adapter_test_users", { name: "Test" });

      const logs = logger.getLogs();
      const queryLog = logs.find((log) => log.type === "query");
      expect(queryLog).toBeTruthy();
      if (queryLog) {
        expect(queryLog.sql).toContain("adapter_test_users");
        expect(queryLog.duration).toBeGreaterThanOrEqual(0);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录执行的详细信息", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      (adapter as any).setQueryLogger(logger);

      await adapter.execute("insert", "adapter_test_users", {
        name: "Log Detail User",
        email: "log_detail@test.com",
        age: 25,
      });

      const logs = logger.getLogs();
      const executeLog = logs.find((log) => log.type === "execute");
      expect(executeLog).toBeTruthy();
      if (executeLog) {
        expect(executeLog.sql).toContain("insert");
        expect(executeLog.duration).toBeGreaterThanOrEqual(0);
      }

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("聚合管道高级功能", () => {
    it("应该支持 $lookup 关联查询", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 插入测试数据
      await adapter.execute("insertMany", "adapter_test_users", [
        { _id: 1, name: "User 1", city: "Beijing" },
        { _id: 2, name: "User 2", city: "Shanghai" },
      ]);

      await adapter.execute("insertMany", "adapter_test_orders", [
        { userId: 1, product: "Product A", price: 100 },
        { userId: 1, product: "Product B", price: 200 },
        { userId: 2, product: "Product C", price: 150 },
      ]);

      // 使用聚合管道进行 $lookup
      const results = await adapter.query("adapter_test_users", {}, {
        pipeline: [
          {
            $lookup: {
              from: "adapter_test_orders",
              localField: "_id",
              foreignField: "userId",
              as: "orders",
            },
          },
        ],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].orders).toBeTruthy();

      await adapter.execute("deleteMany", "adapter_test_users", {});
      await adapter.execute("deleteMany", "adapter_test_orders", {});
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 $group 分组聚合", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      await adapter.execute("insertMany", "adapter_test_users", [
        { name: "User 1", age: 20, city: "Beijing" },
        { name: "User 2", age: 30, city: "Beijing" },
        { name: "User 3", age: 40, city: "Shanghai" },
      ]);

      const results = await adapter.query("adapter_test_users", {}, {
        pipeline: [
          {
            $group: {
              _id: "$city",
              avgAge: { $avg: "$age" },
              count: { $sum: 1 },
            },
          },
        ],
      });

      expect(results.length).toBeGreaterThan(0);
      const beijingGroup = results.find((r) => r._id === "Beijing");
      expect(beijingGroup).toBeTruthy();
      expect(beijingGroup?.count).toBe(2);

      await adapter.execute("deleteMany", "adapter_test_users", {});
    }, { sanitizeOps: false, sanitizeResources: false });
  });
});
