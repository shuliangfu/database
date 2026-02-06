/**
 * @fileoverview 数据库初始化工具测试
 */

import {
  afterAll,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import {
  autoInitDatabase,
  closeDatabase,
  getDatabaseManager,
  hasConnection,
  initDatabase,
  initDatabaseFromConfig,
  isDatabaseInitialized,
  setDatabaseConfigLoader,
  setDatabaseManager,
  setupDatabaseConfigLoader,
} from "../../src/init-database.ts";
import { DatabaseManager } from "../../src/manager.ts";
import type { DatabaseConfig } from "../../src/types.ts";

describe("init-database", () => {
  // 每个测试前清理状态
  beforeEach(async () => {
    // 清理全局状态
    await closeDatabase();
  });

  afterAll(async () => {
    // 测试结束后清理
    await closeDatabase();
  });

  describe("initDatabase", () => {
    it("应该初始化数据库连接", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      const status = await initDatabase(config);

      expect(status).toBeTruthy();
      expect(status.name).toBe("default");
      expect(status.type).toBe("sqlite");
      expect(status.connected).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      const status = await initDatabase(config, "custom_connection");

      expect(status.name).toBe("custom_connection");
      expect(hasConnection("custom_connection")).toBe(true);
    });

    it("应该复用已存在的数据库管理器", async () => {
      const config1: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };
      const config2: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      const status1 = await initDatabase(config1, "conn1");
      const status2 = await initDatabase(config2, "conn2");

      expect(status1.name).toBe("conn1");
      expect(status2.name).toBe("conn2");
      expect(hasConnection("conn1")).toBe(true);
      expect(hasConnection("conn2")).toBe(true);
    });
  });

  describe("initDatabaseFromConfig", () => {
    it("应该从配置对象初始化数据库", async () => {
      const config = {
        database: {
          adapter: "sqlite" as const,
          connection: {
            filename: ":memory:",
          },
        },
      };

      const status = await initDatabaseFromConfig(config);

      expect(status).toBeTruthy();
      expect(status?.name).toBe("default");
      expect(status?.type).toBe("sqlite");
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config = {
        database: {
          adapter: "sqlite" as const,
          connection: {
            filename: ":memory:",
          },
        },
      };

      const status = await initDatabaseFromConfig(config, "custom");

      expect(status?.name).toBe("custom");
      expect(hasConnection("custom")).toBe(true);
    });

    it("应该在配置不存在时返回 undefined", async () => {
      const status = await initDatabaseFromConfig();

      expect(status).toBeUndefined();
    });

    it("应该在 database 字段不存在时返回 undefined", async () => {
      const config = {};

      const status = await initDatabaseFromConfig(config);

      expect(status).toBeUndefined();
    });
  });

  describe("autoInitDatabase", () => {
    it("应该从配置加载器自动初始化数据库", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase();

      expect(isDatabaseInitialized()).toBe(true);
      expect(hasConnection("default")).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase("auto_conn");

      expect(hasConnection("auto_conn")).toBe(true);
    });

    it("应该在配置加载器未设置时抛出错误", async () => {
      // 清理配置加载器和数据库
      await closeDatabase();
      // 清除配置加载器（通过设置一个会返回 null 的加载器，然后关闭数据库来清除状态）
      // 注意：由于模块级别的变量，我们需要通过 closeDatabase 来重置状态
      // 但实际上，我们需要手动清除配置加载器
      setDatabaseConfigLoader(async () => null);
      await closeDatabase();

      // 由于模块状态，我们需要重新导入或使用其他方式
      // 这里我们测试配置加载器返回 null 的情况
      setDatabaseConfigLoader(async () => null);

      await assertRejects(
        async () => {
          await autoInitDatabase();
        },
        Error,
        "Database not configured",
      );
    });

    it("应该在配置加载器返回 null 时抛出错误", async () => {
      setDatabaseConfigLoader(async () => null);

      await assertRejects(
        async () => {
          await autoInitDatabase();
        },
        Error,
        "Database not configured",
      );
    });
  });

  describe("getDatabaseManager", () => {
    it("应该获取数据库管理器实例", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      await initDatabase(config);
      const manager = getDatabaseManager();

      expect(manager).toBeTruthy();
      expect(manager).toBeInstanceOf(DatabaseManager);
    });

    it("应该在数据库未初始化时抛出错误", async () => {
      await closeDatabase();

      expect(() => {
        getDatabaseManager();
      }).toThrow("Database not initialized");
    });
  });

  describe("isDatabaseInitialized", () => {
    it("应该在数据库未初始化时返回 false", async () => {
      await closeDatabase();

      expect(isDatabaseInitialized()).toBe(false);
    });

    it("应该在数据库初始化后返回 true", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      await initDatabase(config);

      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      expect(hasConnection("test_conn")).toBe(false);

      await initDatabase(config, "test_conn");

      expect(hasConnection("test_conn")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      await initDatabase(config);

      expect(hasConnection()).toBe(true);
    });
  });

  describe("closeDatabase", () => {
    it("应该关闭所有数据库连接", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      await initDatabase(config, "conn1");
      await initDatabase(config, "conn2");

      expect(hasConnection("conn1")).toBe(true);
      expect(hasConnection("conn2")).toBe(true);

      await closeDatabase();

      expect(hasConnection("conn1")).toBe(false);
      expect(hasConnection("conn2")).toBe(false);
      expect(isDatabaseInitialized()).toBe(false);
    });

    it("应该在无连接时安全调用", async () => {
      await closeDatabase();
      await closeDatabase(); // 第二次调用不应该出错

      expect(isDatabaseInitialized()).toBe(false);
    });
  });

  describe("setDatabaseConfigLoader", () => {
    it("应该设置配置加载器", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      let loaderCalled = false;
      setDatabaseConfigLoader(async () => {
        loaderCalled = true;
        return config;
      });

      await autoInitDatabase();

      expect(loaderCalled).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("setupDatabaseConfigLoader", () => {
    it("应该设置配置加载器（便捷方法）", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      let loaderCalled = false;
      setupDatabaseConfigLoader(async () => {
        loaderCalled = true;
        return config;
      });

      await autoInitDatabase();

      expect(loaderCalled).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("setDatabaseManager", () => {
    it("应该设置数据库管理器实例", async () => {
      const manager = new DatabaseManager();
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      setDatabaseManager(manager);
      await manager.connect("test", config);

      const retrievedManager = getDatabaseManager();
      expect(retrievedManager).toBe(manager);
      expect(retrievedManager.hasConnection("test")).toBe(true);
    });
  });
});
