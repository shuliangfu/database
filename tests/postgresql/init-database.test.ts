/**
 * @fileoverview 数据库初始化工具测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
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

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      const status = await initDatabase(config);

      expect(status).toBeTruthy();
      expect(status.name).toBe("default");
      expect(status.type).toBe("postgresql");
      expect(status.connected).toBe(true);
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      const status = await initDatabase(config, "custom_connection");

      expect(status.name).toBe("custom_connection");
      expect(hasConnection("custom_connection")).toBe(true);
    });

    it("应该复用已存在的数据库管理器", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config1: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };
      const config2: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config = {
        database: {
          type: "postgresql" as const,
          connection: {
            host: pgHost,
            port: pgPort,
            database: pgDatabase,
            username: pgUser,
            password: pgPassword,
          },
        },
      };

      const status = await initDatabaseFromConfig(config);

      expect(status).toBeTruthy();
      expect(status?.name).toBe("default");
      expect(status?.type).toBe("postgresql");
      expect(isDatabaseInitialized()).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config = {
        database: {
          type: "postgresql" as const,
          connection: {
            host: pgHost,
            port: pgPort,
            database: pgDatabase,
            username: pgUser,
            password: pgPassword,
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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      setDatabaseConfigLoader(async () => config);

      await autoInitDatabase();

      expect(isDatabaseInitialized()).toBe(true);
      expect(hasConnection("default")).toBe(true);
    });

    it("应该支持自定义连接名称", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      await initDatabase(config);

      expect(isDatabaseInitialized()).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      expect(hasConnection("test_conn")).toBe(false);

      await initDatabase(config, "test_conn");

      expect(hasConnection("test_conn")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      await initDatabase(config);

      expect(hasConnection()).toBe(true);
    });
  });

  describe("closeDatabase", () => {
    it("应该关闭所有数据库连接", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
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
      await closeDatabase();

      expect(isDatabaseInitialized()).toBe(false);
    });
  });

  describe("setDatabaseConfigLoader", () => {
    it("应该设置配置加载器", async () => {
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
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
      const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
      const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
      const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
      const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
      const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
      const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      };

      setDatabaseManager(manager);
      await manager.connect("test", config);

      const retrievedManager = getDatabaseManager();
      expect(retrievedManager).toBe(manager);
      expect(retrievedManager.hasConnection("test")).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
