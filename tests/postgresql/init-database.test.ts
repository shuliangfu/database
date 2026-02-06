/**
 * @fileoverview 数据库初始化工具测试
 */

import {
  afterAll,
  afterEach,
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
import { createPostgresConfig } from "./postgres-test-utils.ts";

describe("init-database", () => {
  // 每个测试前清理状态
  beforeEach(async () => {
    // 清理全局状态
    await closeDatabase();
    // Bun 可能并行运行测试文件，导致连接累积（已移除延时以提升测试速度）
  });

  // 每个测试后也清理，确保连接不泄漏
  afterEach(async () => {
    try {
      await closeDatabase();
    } catch {
      // 忽略清理错误
    }
  });

  afterAll(async () => {
    // 测试结束后清理
    await closeDatabase();
  });

  describe("initDatabase", () => {
    it("应该初始化数据库连接", async () => {
      const status = await initDatabase(createPostgresConfig());

      expect(status).toBeTruthy();
      expect(status.name).toBe("default");
      expect(status.type).toBe("postgresql");
      expect(status.connected).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const status = await initDatabase(createPostgresConfig(), "custom_connection");

      expect(status.name).toBe("custom_connection");
      expect(hasConnection("custom_connection")).toBe(true);
    });

    it("应该复用已存在的数据库管理器", async () => {
      const config = createPostgresConfig();
      const status1 = await initDatabase(config, "conn1");
      const status2 = await initDatabase(config, "conn2");

      expect(status1.name).toBe("conn1");
      expect(status2.name).toBe("conn2");
      expect(hasConnection("conn1")).toBe(true);
      expect(hasConnection("conn2")).toBe(true);
    }, { timeout: 30000 });
  });

  describe("initDatabaseFromConfig", () => {
    it("应该从配置对象初始化数据库", async () => {
      const config = {
        database: createPostgresConfig(),
      };

      const status = await initDatabaseFromConfig(config);

      expect(status).toBeTruthy();
      expect(status?.name).toBe("default");
      expect(status?.type).toBe("postgresql");
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config = {
        database: createPostgresConfig(),
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
      const config = createPostgresConfig();
      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase();

      expect(isDatabaseInitialized()).toBe(true);
      expect(hasConnection("default")).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const config = createPostgresConfig();
      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase("auto_conn");

      expect(hasConnection("auto_conn")).toBe(true);
    });

    it("应该在配置加载器未设置时抛出错误", async () => {
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
      await initDatabase(createPostgresConfig());
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
      await initDatabase(createPostgresConfig());

      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      expect(hasConnection("test_conn")).toBe(false);

      await initDatabase(createPostgresConfig(), "test_conn");

      expect(hasConnection("test_conn")).toBe(true);
    }, { timeout: 30000 });

    it("应该使用默认连接名称", async () => {
      await initDatabase(createPostgresConfig());

      expect(hasConnection()).toBe(true);
    }, { timeout: 30000 });
  });

  describe("closeDatabase", () => {
    it("应该关闭所有数据库连接", async () => {
      const config = createPostgresConfig();
      await initDatabase(config, "conn1");
      await initDatabase(config, "conn2");

      expect(hasConnection("conn1")).toBe(true);
      expect(hasConnection("conn2")).toBe(true);

      await closeDatabase();

      // 等待一段时间让连接完全释放

      expect(hasConnection("conn1")).toBe(false);
      expect(hasConnection("conn2")).toBe(false);
      expect(isDatabaseInitialized()).toBe(false);
    }, { timeout: 30000 });

    it("应该在无连接时安全调用", async () => {
      await closeDatabase();
      await closeDatabase();

      expect(isDatabaseInitialized()).toBe(false);
    }, { timeout: 30000 });
  });

  describe("setDatabaseConfigLoader", () => {
    it("应该设置配置加载器", async () => {
      const config = createPostgresConfig();
      let loaderCalled = false;
      setDatabaseConfigLoader(async () => {
        loaderCalled = true;
        return config;
      });

      await autoInitDatabase();

      expect(loaderCalled).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    }, { timeout: 30000 });
  });

  describe("setupDatabaseConfigLoader", () => {
    it("应该设置配置加载器（便捷方法）", async () => {
      const config = createPostgresConfig();
      let loaderCalled = false;
      setupDatabaseConfigLoader(async () => {
        loaderCalled = true;
        return config;
      });

      await autoInitDatabase();

      expect(loaderCalled).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    }, { timeout: 10000 });
  });

  describe("setDatabaseManager", () => {
    it("应该设置数据库管理器实例", async () => {
      const manager = new DatabaseManager();

      setDatabaseManager(manager);
      await manager.connect("test", createPostgresConfig());

      const retrievedManager = getDatabaseManager();
      expect(retrievedManager).toBe(manager);
      expect(retrievedManager.hasConnection("test")).toBe(true);

      // 测试结束后显式清理，确保连接完全释放
      await manager.closeAll();
    }, { timeout: 10000 });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
