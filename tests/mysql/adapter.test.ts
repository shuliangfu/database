/**
 * @fileoverview MySQLAdapter 基础功能测试
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
import { MySQLAdapter } from "../../src/adapters/mysql.ts";
import { QueryLogger } from "../../src/logger/query-logger.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMysqlConfig } from "./mysql-test-utils.ts";

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_NAME = "mysql_adapter_test_users";
const TABLE_ORDERS = "mysql_adapter_test_orders";

describe("MySQLAdapter", () => {
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    try {
      // 直接创建适配器实例进行测试
      adapter = new MySQLAdapter();
      await adapter.connect(createMysqlConfig());
    } catch (error) {
      console.warn(
        `MySQL not available, skipping tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      adapter = null as any;
    }
  });

  afterAll(async () => {
    // 直接关闭适配器连接
    if (adapter && adapter.isConnected()) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    // 创建测试表
    try {
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE,
          age INT
        )`,
        [],
      );
      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);
    } catch {
      // 表可能已存在，忽略错误
    }
  });

  describe("connect", () => {
    it("应该连接到 MySQL 数据库", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      expect(adapter.isConnected()).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在连接失败时抛出错误", async () => {
      const invalidAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await invalidAdapter.connect({
            type: "mysql",
            connection: {
              host: "invalid_host",
              port: 3306,
              database: "invalid_db",
              username: "invalid_user",
              password: "invalid_pass",
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });
  });

  describe("query", () => {
    it("应该执行查询并返回结果", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Alice", "alice@example.com", 25],
      );

      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE name = ?`,
        ["Alice"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
      expect(results[0].email).toBe("alice@example.com");
      expect(results[0].age).toBe(25);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持参数化查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Bob", "bob@example.com", 30],
      );

      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age > ?`,
        [20],
      );

      expect(results.length).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该返回空数组当没有匹配的记录", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["nonexistent@example.com"],
      );

      expect(results.length).toBe(0);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在未连接时抛出错误", async () => {
      const newAdapter = new MySQLAdapter();

      await assertRejects(
        () => newAdapter.query(`SELECT * FROM ${TABLE_NAME}`, []),
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在查询失败时抛出错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM nonexistent_table", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("execute", () => {
    it("应该执行插入操作", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const result = await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Charlie", "charlie@example.com", 35],
      );

      expect(result.affectedRows).toBe(1);
      expect(result.insertId).toBeTruthy();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行更新操作", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["David", "david@example.com", 40],
      );

      const result = await adapter.execute(
        `UPDATE ${TABLE_NAME} SET age = ? WHERE name = ?`,
        [45, "David"],
      );

      expect(result.affectedRows).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该执行删除操作", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Eve", "eve@example.com", 28],
      );

      const result = await adapter.execute(
        `DELETE FROM ${TABLE_NAME} WHERE name = ?`,
        ["Eve"],
      );

      expect(result.affectedRows).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在执行失败时抛出错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.execute("INSERT INTO nonexistent_table VALUES (?)", [
            1,
          ]);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在未连接时抛出错误", async () => {
      const newAdapter = new MySQLAdapter();

      await assertRejects(
        () =>
          newAdapter.execute(`INSERT INTO ${TABLE_NAME} (name) VALUES (?)`, [
            "Alice",
          ]),
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("isConnected", () => {
    it("应该在连接后返回 true", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      expect(adapter.isConnected()).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在关闭后返回 false", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      await testAdapter.connect(createMysqlConfig());

      expect(testAdapter.isConnected()).toBe(true);

      await testAdapter.close();

      expect(testAdapter.isConnected()).toBe(false);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("getPoolStatus", () => {
    it("应该返回连接池状态", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const status = await adapter.getPoolStatus();

      expect(status).toBeTruthy();
      expect(status.total).toBeGreaterThanOrEqual(0); // MySQL 连接池可能为 0
      expect(status.active).toBeGreaterThanOrEqual(0);
      expect(status.idle).toBeGreaterThanOrEqual(0);
      expect(status.waiting).toBeGreaterThanOrEqual(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("healthCheck", () => {
    it("应该执行健康检查", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const result = await adapter.healthCheck();

      expect(result).toBeTruthy();
      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在连接正常时返回健康状态", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
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
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      await testAdapter.connect(createMysqlConfig());

      expect(testAdapter.isConnected()).toBe(true);

      await testAdapter.close();

      expect(testAdapter.isConnected()).toBe(false);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该可以多次调用 close 而不出错", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      await testAdapter.connect(createMysqlConfig());

      await testAdapter.close();
      await testAdapter.close(); // 第二次调用不应该出错
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("transaction", () => {
    it("应该执行事务并提交", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Transaction User 1", "trans1@test.com", 25],
        );
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Transaction User 2", "trans2@test.com", 30],
        );
      });

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email IN (?, ?)`,
        ["trans1@test.com", "trans2@test.com"],
      );
      expect(users.length).toBe(2);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务中回滚错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.execute(
              `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
              ["Transaction User", "trans@test.com", 25],
            );
            // 故意触发错误（违反唯一约束）
            await db.execute(
              `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
              ["Transaction User 2", "trans@test.com", 30], // 重复的 email
            );
          });
        },
        Error,
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["trans@test.com"],
      );
      expect(users.length).toBe(0); // 事务应该回滚，没有数据
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("savepoints", () => {
    it("应该支持创建保存点", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Savepoint User", "savepoint@test.com", 25],
        );

        await db.createSavepoint("sp1");

        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "savepoint@test.com"],
        );

        const user = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["savepoint@test.com"],
        );
        expect(user[0].age).toBe(30);

        await db.rollbackToSavepoint("sp1");

        const userAfterRollback = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["savepoint@test.com"],
        );
        expect(userAfterRollback[0].age).toBe(25);
      });

      const finalUser = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["savepoint@test.com"],
      );
      expect(finalUser.length).toBe(1);
      expect(finalUser[0].age).toBe(25);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持释放保存点", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Release User", "release@test.com", 25],
        );

        await db.createSavepoint("sp1");
        await db.releaseSavepoint("sp1");

        // 释放后应该不能再回滚
        await assertRejects(
          async () => {
            await db.rollbackToSavepoint("sp1");
          },
          Error,
        );
      });
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("query logger", () => {
    it("应该支持设置和获取查询日志记录器", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const { QueryLogger } = await import("../../src/logger/query-logger.ts");
      const logger = new QueryLogger();

      adapter.setQueryLogger(logger);
      expect(adapter.getQueryLogger()).toBe(logger);

      // 执行一个查询，验证日志记录
      await adapter.query("SELECT 1", []);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].type).toBe("query");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("BaseAdapter 辅助方法", () => {
    describe("getLastHealthCheck", () => {
      it("应该在初始状态下返回 null", () => {
        const newAdapter = new MySQLAdapter();
        expect(newAdapter.getLastHealthCheck()).toBeNull();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该在健康检查后返回时间", async () => {
        const newAdapter = new MySQLAdapter();
        await newAdapter.connect(createMysqlConfig());

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
        const newAdapter = new MySQLAdapter();
        newAdapter.setHealthCheckInterval(60000);

        expect(newAdapter).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持不同的间隔值", () => {
        const newAdapter = new MySQLAdapter();
        newAdapter.setHealthCheckInterval(1000);
        newAdapter.setHealthCheckInterval(5000);
        newAdapter.setHealthCheckInterval(30000);

        expect(newAdapter).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("setQueryLogger", () => {
      it("应该设置查询日志记录器", () => {
        const logger = new QueryLogger();
        adapter.setQueryLogger(logger);

        const retrievedLogger = adapter.getQueryLogger();
        expect(retrievedLogger).toBe(logger);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持替换日志记录器", () => {
        const logger1 = new QueryLogger();
        const logger2 = new QueryLogger();

        adapter.setQueryLogger(logger1);
        expect(adapter.getQueryLogger()).toBe(logger1);

        adapter.setQueryLogger(logger2);
        expect(adapter.getQueryLogger()).toBe(logger2);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该支持设置为 null", () => {
        const logger = new QueryLogger();
        adapter.setQueryLogger(logger);
        expect(adapter.getQueryLogger()).toBe(logger);

        const newAdapter = new MySQLAdapter();
        expect(newAdapter.getQueryLogger()).toBeNull();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("getQueryLogger", () => {
      it("应该在未设置时返回 null", async () => {
        const newAdapter = new MySQLAdapter();
        await newAdapter.connect(createMysqlConfig());

        expect(newAdapter.getQueryLogger()).toBeNull();

        await newAdapter.close();
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该返回设置的日志记录器", () => {
        const logger = new QueryLogger({
          enabled: true,
          logLevel: "all",
        });

        adapter.setQueryLogger(logger);
        const retrievedLogger = adapter.getQueryLogger();

        expect(retrievedLogger).toBe(logger);
        expect(retrievedLogger?.getLogger()).toBeTruthy();
      }, { sanitizeOps: false, sanitizeResources: false });
    });

    describe("isConnected", () => {
      it("应该在连接后返回 true", () => {
        expect(adapter.isConnected()).toBe(true);
      }, { sanitizeOps: false, sanitizeResources: false });

      it("应该在未连接时返回 false", async () => {
        const newAdapter = new MySQLAdapter();
        expect(newAdapter.isConnected()).toBe(false);

        await newAdapter.connect(createMysqlConfig());
        expect(newAdapter.isConnected()).toBe(true);

        await newAdapter.close();
        expect(newAdapter.isConnected()).toBe(false);
      }, { sanitizeOps: false, sanitizeResources: false });
    });
  });

  describe("事务适配器", () => {
    it("应该在事务适配器中执行查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Transaction User", "tx@test.com", 25],
        );

        const users = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["tx@test.com"],
        );
        expect(users.length).toBe(1);
        expect(users[0].name).toBe("Transaction User");
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中执行更新", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Update User", "update@test.com", 25],
        );

        const result = await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "update@test.com"],
        );
        expect(result.affectedRows).toBe(1);

        const users = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["update@test.com"],
        );
        expect(users[0].age).toBe(30);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中获取连接池状态", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const status = await db.getPoolStatus();
        expect(status.total).toBe(1);
        expect(status.active).toBe(1);
        expect(status.idle).toBe(0);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在事务适配器中执行健康检查", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.transaction(async (db: DatabaseAdapter) => {
        const health = await db.healthCheck();
        expect(health.healthy).toBe(true);
        expect(health.latency).toBeGreaterThanOrEqual(0);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该禁止在事务适配器中关闭连接", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.close();
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("保存点高级功能", () => {
    it("应该处理保存点名称冲突", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Conflict User", "conflict@test.com", 25],
        );

        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "conflict@test.com"],
        );

        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [35, "conflict@test.com"],
        );

        // 回滚到第二个 sp1（应该回滚到 age=30 的状态，即第二个 sp1 创建时的状态）
        await db.rollbackToSavepoint("sp1");
        const user = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["conflict@test.com"],
        );
        // 现在实现会回滚到最后一个匹配的保存点（最新的），所以应该是 30
        expect(user[0].age).toBe(30);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理保存点不存在的情况", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await assertRejects(
        async () => {
          await adapter.transaction(async (db: DatabaseAdapter) => {
            await db.rollbackToSavepoint("nonexistent");
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持多层保存点", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        await db.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Multi User", "multi@test.com", 10],
        );

        // 创建 sp1（此时 age=10）
        await db.createSavepoint("sp1");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [20, "multi@test.com"],
        );

        // 创建 sp2（此时 age=20）
        await db.createSavepoint("sp2");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [30, "multi@test.com"],
        );

        // 创建 sp3（此时 age=30）
        await db.createSavepoint("sp3");
        await db.execute(
          `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
          [40, "multi@test.com"],
        );

        // 回滚到 sp2，应该回到 sp2 创建时的状态（age=20）
        // 但测试期望是 age=30，这说明测试逻辑可能有问题
        // 实际上，MySQL 的 ROLLBACK TO SAVEPOINT 会回滚到保存点创建时的状态
        // 所以回滚到 sp2 应该回到 age=20（sp2 创建时的状态）
        await db.rollbackToSavepoint("sp2");
        const user = await db.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["multi@test.com"],
        );
        // 修正期望值：回滚到 sp2 应该回到 sp2 创建时的状态（age=20）
        expect(user[0].age).toBe(20);
      });
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("复杂SQL查询", () => {
    it("应该支持JOIN查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);
      await adapter.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_ORDERS} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          product VARCHAR(255),
          price DECIMAL(10,2)
        )`,
        [],
      );

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Join User", "join@test.com", 25],
      );

      const users = await adapter.query(
        `SELECT id FROM ${TABLE_NAME} WHERE email = ?`,
        ["join@test.com"],
      );
      const userId = users[0].id;

      await adapter.execute(
        `INSERT INTO ${TABLE_ORDERS} (user_id, product, price) VALUES (?, ?, ?)`,
        [userId, "Product A", 100.50],
      );

      const results = await adapter.query(
        `SELECT u.name, u.email, o.product, o.price
         FROM ${TABLE_NAME} u
         JOIN ${TABLE_ORDERS} o ON u.id = o.user_id
         WHERE u.email = ?`,
        ["join@test.com"],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Join User");
      expect(results[0].product).toBe("Product A");

      await adapter.execute(`DROP TABLE IF EXISTS ${TABLE_ORDERS}`, []);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持聚合函数", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          30,
          "User 3",
          "user3@test.com",
          40,
        ],
      );

      const result = await adapter.query(
        `SELECT COUNT(*) as count, AVG(age) as avg_age, MAX(age) as max_age, MIN(age) as min_age FROM ${TABLE_NAME}`,
        [],
      );

      expect(parseInt(result[0].count)).toBe(3);
      const avgAge = parseFloat(result[0].avg_age);
      expect(avgAge).toBeGreaterThanOrEqual(29.9);
      expect(avgAge).toBeLessThanOrEqual(30.1);
      expect(parseInt(result[0].max_age)).toBe(40);
      expect(parseInt(result[0].min_age)).toBe(20);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持子查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?)`,
        ["Young User", "young@test.com", 20, "Old User", "old@test.com", 50],
      );

      const results = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age > (SELECT AVG(age) FROM ${TABLE_NAME})`,
        [],
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Old User");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("批量操作", () => {
    it("应该支持批量插入", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db: DatabaseAdapter) => {
        for (let i = 1; i <= 5; i++) {
          await db.execute(
            `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
            [`Batch User ${i}`, `batch${i}@test.com`, 20 + i],
          );
        }
      });

      const count = await adapter.query(
        `SELECT COUNT(*) as count FROM ${TABLE_NAME}`,
        [],
      );
      expect(parseInt(count[0].count)).toBe(5);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持批量更新", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          20,
          "User 3",
          "user3@test.com",
          20,
        ],
      );

      const result = await adapter.execute(
        `UPDATE ${TABLE_NAME} SET age = ? WHERE age = ?`,
        [30, 20],
      );

      expect(result.affectedRows).toBe(3);

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE age = ?`,
        [30],
      );
      expect(users.length).toBe(3);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持批量删除", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          "User 1",
          "user1@test.com",
          20,
          "User 2",
          "user2@test.com",
          30,
          "User 3",
          "user3@test.com",
          40,
        ],
      );

      const result = await adapter.execute(
        `DELETE FROM ${TABLE_NAME} WHERE age < ?`,
        [35],
      );

      expect(result.affectedRows).toBe(2);

      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持获取最后插入的ID", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      const result = await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["ID User", "id@test.com", 25],
      );

      expect(result.insertId).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询日志记录", () => {
    it("应该记录查询日志", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.query("SELECT 1 as test", []);
      await adapter.query("SELECT 2 as test", []);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((log) => log.type === "query")).toBe(true);
      expect(logs.some((log) => log.sql?.includes("SELECT"))).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录执行日志", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Log User", "log@test.com", 25],
      );

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((log) => log.type === "execute")).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录错误日志", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      try {
        await adapter.query("SELECT * FROM nonexistent_table", []);
      } catch {
        // 忽略错误
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("边界条件", () => {
    it("应该处理空参数数组", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const result = await adapter.query("SELECT 1 as test", []);
      expect(result.length).toBe(1);
      expect(result[0].test).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理null参数", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Null User", null, null],
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE name = ?`,
        ["Null User"],
      );
      expect(users.length).toBe(1);
      expect(users[0].email).toBeNull();
      expect(users[0].age).toBeNull();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理特殊字符", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      const specialName = 'User\'s Name & "Special" <Chars>';
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        [specialName, "special@test.com", 25],
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["special@test.com"],
      );
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(specialName);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该防止SQL注入", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      const maliciousInput = `'; DROP TABLE ${TABLE_NAME}; --`;
      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        [maliciousInput, "inject@test.com", 25],
      );

      const users = await adapter.query(`SELECT * FROM ${TABLE_NAME}`, []);
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(maliciousInput);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("错误处理", () => {
    it("应该处理连接配置错误", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            type: "mysql",
            connection: {
              host: "invalid_host",
              port: 3306,
              database: "invalid_db",
              username: "invalid_user",
              password: "invalid_pass",
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该处理缺少必需配置", async () => {
      const badAdapter = new MySQLAdapter();
      await assertRejects(
        async () => {
          await badAdapter.connect({
            type: "mysql",
            connection: {
              host: "",
              database: "",
            } as any,
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 10000 });

    it("应该处理SQL语法错误", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
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
        console.log("MySQL not available, skipping test");
        return;
      }

      await assertRejects(
        async () => {
          await adapter.query("SELECT * FROM nonexistent_table_12345", []);
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接重试机制", () => {
    it("应该在连接失败时自动重试", async () => {
      const testAdapter = new MySQLAdapter();

      await assertRejects(
        async () => {
          await testAdapter.connect({
            type: "mysql",
            connection: {
              host: "invalid_host_that_does_not_exist",
              port: 3306,
              database: "invalid_db",
              username: "invalid_user",
              password: "invalid_pass",
            },
            pool: {
              maxRetries: 2,
              retryDelay: 100,
            },
          });
        },
        Error,
      );
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接池配置", () => {
    it("应该支持自定义连接池配置", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const testAdapter = new MySQLAdapter();
      await testAdapter.connect(
        createMysqlConfig({
          pool: {
            max: 5,
          },
        }),
      );

      const status = await testAdapter.getPoolStatus();
      expect(status.total).toBeGreaterThanOrEqual(0);

      await testAdapter.close();
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("嵌套事务", () => {
    it("应该支持嵌套事务", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await adapter.transaction(async (db1: DatabaseAdapter) => {
        await db1.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          ["Nested User", "nested@test.com", 25],
        );

        await db1.transaction(async (db2: DatabaseAdapter) => {
          await db2.execute(
            `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
            [30, "nested@test.com"],
          );

          await db2.transaction(async (db3: DatabaseAdapter) => {
            await db3.execute(
              `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
              [35, "nested@test.com"],
            );
          });
        });

        const users = await db1.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          ["nested@test.com"],
        );
        expect(users[0].age).toBe(35);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该在嵌套事务中回滚", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      await assertRejects(
        async () => {
          await adapter.transaction(async (db1: DatabaseAdapter) => {
            await db1.execute(
              `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
              ["Nested Rollback User", "nested_rollback@test.com", 25],
            );

            await db1.transaction(async (db2: DatabaseAdapter) => {
              await db2.execute(
                `UPDATE ${TABLE_NAME} SET age = ? WHERE email = ?`,
                [30, "nested_rollback@test.com"],
              );

              throw new Error("Nested transaction error");
            });
          });
        },
        Error,
      );

      const users = await adapter.query(
        `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
        ["nested_rollback@test.com"],
      );
      expect(users.length).toBe(0);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("并发操作", () => {
    it("应该支持并发查询", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      for (let i = 1; i <= 10; i++) {
        await adapter.execute(
          `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
          [`Concurrent User ${i}`, `concurrent${i}@test.com`, 20 + i],
        );
      }

      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.query(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          [`concurrent${i + 1}@test.com`],
        ));

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach((result, index) => {
        expect(result.length).toBe(1);
        expect(result[0].email).toBe(`concurrent${index + 1}@test.com`);
      });
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持并发事务", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      const promises = Array.from(
        { length: 5 },
        (_, i) =>
          adapter.transaction(async (db: DatabaseAdapter) => {
            await db.execute(
              `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
              [`Concurrent TX User ${i}`, `concurrent_tx${i}@test.com`, 20 + i],
            );
            return i;
          }),
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);

      const count = await adapter.query(
        `SELECT COUNT(*) as count FROM ${TABLE_NAME}`,
        [],
      );
      expect(parseInt(count[0].count)).toBe(5);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("查询日志详细验证", () => {
    it("应该记录查询的详细信息", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.query("SELECT ? as test", [42]);

      const logs = logger.getLogs();
      const queryLog = logs.find((log) => log.type === "query");
      expect(queryLog).toBeTruthy();
      if (queryLog) {
        expect(queryLog.sql).toContain("SELECT");
        expect(queryLog.params).toEqual([42]);
        expect(queryLog.duration).toBeGreaterThanOrEqual(0);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该记录执行的详细信息", async () => {
      if (!adapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      await adapter.execute(`TRUNCATE TABLE ${TABLE_NAME}`, []);

      const logger = new QueryLogger({ enabled: true, logLevel: "all" });
      adapter.setQueryLogger(logger);

      await adapter.execute(
        `INSERT INTO ${TABLE_NAME} (name, email, age) VALUES (?, ?, ?)`,
        ["Log Detail User", "log_detail@test.com", 25],
      );

      const logs = logger.getLogs();
      const executeLog = logs.find((log) => log.type === "execute");
      expect(executeLog).toBeTruthy();
      if (executeLog) {
        expect(executeLog.sql).toContain("INSERT");
        expect(executeLog.params).toEqual([
          "Log Detail User",
          "log_detail@test.com",
          25,
        ]);
        expect(executeLog.duration).toBeGreaterThanOrEqual(0);
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
});
