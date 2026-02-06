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
import { createMysqlConfig } from "./mysql-test-utils.ts";

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
      const status = await initDatabase(createMysqlConfig());

      expect(status).toBeTruthy();
      expect(status.name).toBe("default");
      expect(status.type).toBe("mysql");
      expect(status.connected).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const status = await initDatabase(
        createMysqlConfig(),
        "custom_connection",
      );

      expect(status.name).toBe("custom_connection");
      expect(hasConnection("custom_connection")).toBe(true);
    });

    it("应该复用已存在的数据库管理器", async () => {
      const config = createMysqlConfig();
      const status1 = await initDatabase(config, "conn1");
      const status2 = await initDatabase(config, "conn2");

      expect(status1.name).toBe("conn1");
      expect(status2.name).toBe("conn2");
      expect(hasConnection("conn1")).toBe(true);
      expect(hasConnection("conn2")).toBe(true);
    });
  });

  describe("initDatabaseFromConfig", () => {
    it("应该从配置对象初始化数据库", async () => {
      const config = {
        database: createMysqlConfig(),
      };

      const status = await initDatabaseFromConfig(config);

      expect(status).toBeTruthy();
      expect(status?.name).toBe("default");
      expect(status?.type).toBe("mysql");
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config = {
        database: createMysqlConfig(),
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
      const config = createMysqlConfig();
      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase();

      expect(isDatabaseInitialized()).toBe(true);
      expect(hasConnection("default")).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config = createMysqlConfig();
      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase("auto_conn");

      expect(hasConnection("auto_conn")).toBe(true);
    });

    it("应该在配置加载器未设置时抛出错误", async () => {
      // 清理配置加载器和数据库
      await closeDatabase();
      setDatabaseConfigLoader(async () => null);
      await closeDatabase();

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
      await initDatabase(createMysqlConfig());
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
      await initDatabase(createMysqlConfig());

      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      expect(hasConnection("test_conn")).toBe(false);

      await initDatabase(createMysqlConfig(), "test_conn");

      expect(hasConnection("test_conn")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      await initDatabase(createMysqlConfig());

      expect(hasConnection()).toBe(true);
    });
  });

  describe("closeDatabase", () => {
    it("应该关闭所有数据库连接", async () => {
      const config = createMysqlConfig();
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
      const config = createMysqlConfig();
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
      const config = createMysqlConfig();
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

      setDatabaseManager(manager);
      await manager.connect("test", createMysqlConfig());

      const retrievedManager = getDatabaseManager();
      expect(retrievedManager).toBe(manager);
      expect(retrievedManager.hasConnection("test")).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
