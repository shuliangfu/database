/**
 * @fileoverview 事务和嵌套事务测试
 * 测试所有适配器的事务功能和嵌套事务（保存点）功能
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
import { MongoDBAdapter } from "../src/adapters/mongodb.ts";
import { MySQLAdapter } from "../src/adapters/mysql.ts";
import { PostgreSQLAdapter } from "../src/adapters/postgresql.ts";
import { SQLiteAdapter } from "../src/adapters/sqlite.ts";

/**
 * 获取环境变量（跨运行时，带默认值）
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * SQLite 事务测试
 */
describe("SQLiteAdapter - Transaction", () => {
  let adapter: SQLiteAdapter;

  beforeEach(async () => {
    adapter = new SQLiteAdapter();
    await adapter.connect({
      type: "sqlite",
      connection: { filename: ":memory:" },
    });

    // 创建测试表
    await adapter.execute(
      `CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0
      )`,
      [],
    );
  });

  afterEach(async () => {
    await adapter?.close();
  });

  describe("基本事务", () => {
    it("应该执行事务并提交", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );
        await db.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Bob", 100],
        );
      });

      // 验证事务已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900);
      expect(accounts[1].balance).toBe(100);
    }, { timeout: 15000 });

    it("应该在事务中回滚错误", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db) => {
          await db.execute(
            "UPDATE accounts SET balance = balance - ? WHERE name = ?",
            [100, "Alice"],
          );
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(1000); // 余额未改变
    });
  });

  describe("嵌套事务（保存点）", () => {
    it("应该支持嵌套事务并提交", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务（使用保存点）
        await outerTx.transaction(async (innerTx) => {
          await innerTx.execute(
            "INSERT INTO accounts (name, balance) VALUES (?, ?)",
            ["Bob", 100],
          );
        });

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证所有操作都已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(3);
      expect(accounts[0].balance).toBe(900); // Alice
      expect(accounts[1].balance).toBe(100); // Bob
      expect(accounts[2].balance).toBe(50); // Charlie
    });

    it("嵌套事务回滚应该只回滚内层操作", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务失败（应该只回滚内层）
        try {
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              "INSERT INTO accounts (name, balance) VALUES (?, ?)",
              ["Bob", 100],
            );
            throw new Error("Inner transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证：外层操作已提交，内层操作已回滚
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900); // Alice (外层操作)
      expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
      // Bob 不应该存在（内层操作已回滚）
    });

    it("应该支持手动创建和释放保存点", async () => {
      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (tx) => {
        // 创建保存点
        await tx.createSavepoint("sp1");

        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 回滚到保存点
        await tx.rollbackToSavepoint("sp1");

        // 验证回滚成功
        const alice = await tx.query(
          "SELECT * FROM accounts WHERE name = ?",
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变

        // 再次操作
        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [50, "Alice"],
        );

        // 释放保存点
        await tx.releaseSavepoint("sp1");
      });

      // 验证最终状态
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(950);
    });

    it("应该在非事务上下文中调用保存点方法时抛出错误", async () => {
      // 不在事务中调用保存点方法应该抛出错误
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
    });
  });
});

/**
 * PostgreSQL 事务测试
 */
describe("PostgreSQLAdapter - Transaction", () => {
  let adapter: PostgreSQLAdapter;

  beforeEach(async () => {
    adapter = new PostgreSQLAdapter();
    // 注意：需要实际的 PostgreSQL 数据库连接
    // 如果环境变量未设置，跳过测试
    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    // 默认使用当前系统用户名，因为本地 PostgreSQL 可能使用系统用户名而不是 postgres
    // 优先使用环境变量，否则尝试获取系统用户名（USER 或 USERNAME），最后回退到 postgres
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

      // 创建测试表
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          balance INTEGER NOT NULL DEFAULT 0
        )`,
        [],
      );

      // 清空表
      await adapter.execute("TRUNCATE TABLE accounts", []);
    } catch (error) {
      // PostgreSQL 不可用，跳过测试
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.warn(
        `PostgreSQL not available, skipping tests. Error: ${errorMessage}`,
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
        // 先尝试清理表（如果连接正常）
        if (adapter.isConnected()) {
          try {
            await adapter.execute("DROP TABLE IF EXISTS accounts", []);
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
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
          [100, "Alice"],
        );
        await db.execute(
          "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
          ["Bob", 100],
        );
      });

      // 验证事务已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900);
      expect(accounts[1].balance).toBe(100);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db) => {
          await db.execute(
            "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
            [100, "Alice"],
          );
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = $1",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(1000); // 余额未改变
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });

  describe("嵌套事务（保存点）", () => {
    it("应该支持嵌套事务并提交", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
          [100, "Alice"],
        );

        // 嵌套事务（使用保存点）
        await outerTx.transaction(async (innerTx) => {
          await innerTx.execute(
            "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
            ["Bob", 100],
          );
        });

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
          ["Charlie", 50],
        );
      });

      // 验证所有操作都已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(3);
      expect(accounts[0].balance).toBe(900); // Alice
      expect(accounts[1].balance).toBe(100); // Bob
      expect(accounts[2].balance).toBe(50); // Charlie
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("嵌套事务回滚应该只回滚内层操作", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
          [100, "Alice"],
        );

        // 嵌套事务失败（应该只回滚内层）
        try {
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
              ["Bob", 100],
            );
            throw new Error("Inner transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
          ["Charlie", 50],
        );
      });

      // 验证：外层操作已提交，内层操作已回滚
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900); // Alice (外层操作)
      expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
      // Bob 不应该存在（内层操作已回滚）
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该支持手动创建和释放保存点", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES ($1, $2)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (tx) => {
        // 创建保存点
        await tx.createSavepoint("sp1");

        await tx.execute(
          "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
          [100, "Alice"],
        );

        // 回滚到保存点
        await tx.rollbackToSavepoint("sp1");

        // 验证回滚成功
        const alice = await tx.query(
          "SELECT * FROM accounts WHERE name = $1",
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变

        // 再次操作
        await tx.execute(
          "UPDATE accounts SET balance = balance - $1 WHERE name = $2",
          [50, "Alice"],
        );

        // 释放保存点
        await tx.releaseSavepoint("sp1");
      });

      // 验证最终状态
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = $1",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(950);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });
});

/**
 * MySQL 事务测试
 */
describe("MySQLAdapter - Transaction", () => {
  let adapter: MySQLAdapter;

  beforeEach(async () => {
    adapter = new MySQLAdapter();
    // 注意：需要实际的 MySQL 数据库连接
    const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
    const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
    const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
    const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
    // MariaDB/MySQL 从外部连接可能需要密码，默认尝试空密码，如果失败可以通过环境变量设置
    const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

    try {
      await adapter.connect({
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      });

      // 创建测试表
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          balance INT NOT NULL DEFAULT 0
        )`,
        [],
      );

      // 清空表
      await adapter.execute("TRUNCATE TABLE accounts", []);
    } catch (error) {
      // MySQL 不可用，跳过测试
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.warn(
        `MySQL not available, skipping tests. Error: ${errorMessage}`,
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
        // 先尝试清理表（如果连接正常）
        if (adapter.isConnected()) {
          try {
            await adapter.execute("DROP TABLE IF EXISTS accounts", []);
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
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (db) => {
        await db.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );
        await db.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Bob", 100],
        );
      });

      // 验证事务已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900);
      expect(accounts[1].balance).toBe(100);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) return;

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      try {
        await adapter.transaction(async (db) => {
          await db.execute(
            "UPDATE accounts SET balance = balance - ? WHERE name = ?",
            [100, "Alice"],
          );
          throw new Error("Transaction error");
        });
      } catch {
        // 预期会抛出错误
      }

      // 验证事务已回滚
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(1000); // 余额未改变
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });

  describe("嵌套事务（保存点）", () => {
    it("应该支持嵌套事务并提交", async () => {
      if (!adapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务（使用保存点）
        await outerTx.transaction(async (innerTx) => {
          await innerTx.execute(
            "INSERT INTO accounts (name, balance) VALUES (?, ?)",
            ["Bob", 100],
          );
        });

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证所有操作都已提交
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(3);
      expect(accounts[0].balance).toBe(900); // Alice
      expect(accounts[1].balance).toBe(100); // Bob
      expect(accounts[2].balance).toBe(50); // Charlie
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("嵌套事务回滚应该只回滚内层操作", async () => {
      if (!adapter) return;

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (outerTx) => {
        // 外层事务操作
        await outerTx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 嵌套事务失败（应该只回滚内层）
        try {
          await outerTx.transaction(async (innerTx) => {
            await innerTx.execute(
              "INSERT INTO accounts (name, balance) VALUES (?, ?)",
              ["Bob", 100],
            );
            throw new Error("Inner transaction error");
          });
        } catch {
          // 预期会抛出错误
        }

        // 外层事务继续
        await outerTx.execute(
          "INSERT INTO accounts (name, balance) VALUES (?, ?)",
          ["Charlie", 50],
        );
      });

      // 验证：外层操作已提交，内层操作已回滚
      const accounts = await adapter.query(
        "SELECT * FROM accounts ORDER BY name",
        [],
      );
      expect(accounts.length).toBe(2);
      expect(accounts[0].balance).toBe(900); // Alice (外层操作)
      expect(accounts[1].balance).toBe(50); // Charlie (外层操作)
      // Bob 不应该存在（内层操作已回滚）
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });

    it("应该支持手动创建和释放保存点", async () => {
      if (!adapter) return;

      await adapter.execute(
        "INSERT INTO accounts (name, balance) VALUES (?, ?)",
        ["Alice", 1000],
      );

      await adapter.transaction(async (tx) => {
        // 创建保存点
        await tx.createSavepoint("sp1");

        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [100, "Alice"],
        );

        // 回滚到保存点
        await tx.rollbackToSavepoint("sp1");

        // 验证回滚成功
        const alice = await tx.query(
          "SELECT * FROM accounts WHERE name = ?",
          ["Alice"],
        );
        expect(alice[0].balance).toBe(1000); // 余额未改变

        // 再次操作
        await tx.execute(
          "UPDATE accounts SET balance = balance - ? WHERE name = ?",
          [50, "Alice"],
        );

        // 释放保存点
        await tx.releaseSavepoint("sp1");
      });

      // 验证最终状态
      const alice = await adapter.query(
        "SELECT * FROM accounts WHERE name = ?",
        ["Alice"],
      );
      expect(alice[0].balance).toBe(950);
    }, {
      sanitizeResources: false,
      sanitizeOps: false,
    });
  });
});

/**
 * MongoDB 事务测试
 * 注意：MongoDB 不支持保存点（savepoints），只支持基本事务
 */
describe("MongoDBAdapter - Transaction", () => {
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
