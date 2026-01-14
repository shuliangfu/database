/**
 * @fileoverview MongoDB 事务测试
 * 注意：MongoDB 不支持保存点（savepoints），只支持基本事务
 */

import { getEnv } from "@dreamer/runtime-adapter";
import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";

/**
 * 获取环境变量（跨运行时，带默认值）
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("事务测试", () => {
  let adapter: MongoDBAdapter;

  beforeEach(async () => {
    adapter = new MongoDBAdapter();
    // 注意：需要实际的 MongoDB 数据库连接
    const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
    const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
    const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");

    try {
      await adapter.connect({
        type: "mongodb",
        connection: {
          host: mongoHost,
          port: mongoPort,
          database: mongoDatabase,
        },
        mongoOptions: {
          replicaSet: "rs0", // 指定副本集名称
          directConnection: true,
        },
      });

      // 清空测试集合
      const db = adapter.getDatabase();
      if (db) {
        await db.collection("accounts").deleteMany({});
      }
    } catch (error) {
      // MongoDB 不可用，跳过测试
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.warn(
        `MongoDB not available, skipping tests. Error: ${errorMessage}`,
      );
      // 确保清理已创建的资源
      try {
        if (adapter && adapter.isConnected()) {
          await adapter.close();
        }
      } catch {
        // 忽略关闭错误
      }
      adapter = null as any;
    }
  });

  afterEach(async () => {
    if (adapter) {
      try {
        // 清理测试数据
        const db = adapter.getDatabase();
        if (db) {
          try {
            await db.collection("accounts").deleteMany({});
          } catch {
            // 忽略错误
          }
        }
      } catch {
        // 忽略错误
      }
      // 确保关闭连接
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  describe("基本事务", () => {
    it("应该执行事务并提交", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 检查是否支持事务（单机 MongoDB 不支持事务）
      try {
        // 尝试执行一个空事务来检测是否支持
        await adapter.transaction(async () => {
          // 空事务，仅用于检测
        });
      } catch (error: any) {
        // 如果不支持事务，跳过此测试
        if (
          error?.code === "4006" ||
          error?.message?.includes("not supported") ||
          error?.message?.includes("replica set")
        ) {
          console.log(
            "MongoDB does not support transactions (single-node instance), skipping transaction test",
          );
          return;
        }
        throw error;
      }

      // 插入初始数据
      await adapter.execute("insert", "accounts", {
        name: "Alice",
        balance: 1000,
      });

      await adapter.transaction(async (db) => {
        // 更新数据
        await db.execute("update", "accounts", {
          filter: { name: "Alice" },
          update: { $inc: { balance: -100 } },
        });

        // 插入新数据
        await db.execute("insert", "accounts", {
          name: "Bob",
          balance: 100,
        });
      });

      // 验证事务已提交
      const accounts = await adapter.query("accounts", {});
      expect(accounts.length).toBe(2);
      const alice = accounts.find((a: any) => a.name === "Alice");
      const bob = accounts.find((a: any) => a.name === "Bob");
      expect(alice?.balance).toBe(900);
      expect(bob?.balance).toBe(100);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
      timeout: 15000,
    });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // 检查是否支持事务（单机 MongoDB 不支持事务）
      let supportsTransactions = false;
      try {
        // 尝试执行一个空事务来检测是否支持
        await adapter.transaction(async () => {
          // 空事务，仅用于检测
        });
        supportsTransactions = true;
      } catch (error: any) {
        // 如果不支持事务，跳过此测试
        if (
          error?.code === "4006" ||
          error?.message?.includes("not supported") ||
          error?.message?.includes("replica set")
        ) {
          console.log(
            "MongoDB does not support transactions (single-node instance), skipping rollback test",
          );
          return;
        }
        throw error;
      }

      // 插入初始数据
      await adapter.execute("insert", "accounts", {
        name: "Alice",
        balance: 1000,
      });

      try {
        await adapter.transaction(async (db) => {
          // 更新数据
          await db.execute("update", "accounts", {
            filter: { name: "Alice" },
            update: { $inc: { balance: -100 } },
          });
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const accounts = await adapter.query("accounts", { name: "Alice" });
      expect(accounts.length).toBe(1);
      expect(accounts[0].balance).toBe(1000); // 余额未改变
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });

  describe("MongoDB 不支持保存点", () => {
    it("应该明确不支持保存点操作", async () => {
      if (!adapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      // MongoDB 不支持保存点，应该抛出错误
      await assertRejects(
        async () => await adapter.createSavepoint("test"),
        Error,
      );
      await assertRejects(
        async () => await adapter.rollbackToSavepoint("test"),
        Error,
      );
      await assertRejects(
        async () => await adapter.releaseSavepoint("test"),
        Error,
      );
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });
});
