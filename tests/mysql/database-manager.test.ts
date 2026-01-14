/**
 * @fileoverview DatabaseManager 测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { DatabaseManager } from "../../src/manager.ts";
import type { DatabaseConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("DatabaseManager", () => {
  let manager: DatabaseManager;

  beforeAll(() => {
    manager = new DatabaseManager();
  });

  afterAll(async () => {
    await manager?.closeAll();
  });

  describe("connect", () => {
    it("应该连接到 MySQL 数据库", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      const status = await manager.connect("mysql_test", config);

      expect(status.name).toBe("mysql_test");
      expect(status.type).toBe("mysql");
      expect(status.connected).toBe(true);
    });

    it("应该支持多个连接", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config1: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };
      const config2: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("connection1", config1);
      await manager.connect("connection2", config2);

      expect(manager.hasConnection("connection1")).toBe(true);
      expect(manager.hasConnection("connection2")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      const status = await manager.connect(undefined, config);

      expect(status.name).toBe("default");
      expect(manager.hasConnection("default")).toBe(true);
    });
  });

  describe("getConnection", () => {
    it("应该获取已存在的连接", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("test_connection", config);
      const adapter = manager.getConnection("test_connection");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("default", config);
      const adapter = manager.getConnection();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该在连接不存在时抛出错误", () => {
      expect(() => {
        manager.getConnection("nonexistent");
      }).toThrow();
    });
  });

  describe("close", () => {
    it("应该关闭指定连接", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("close_test", config);
      expect(manager.hasConnection("close_test")).toBe(true);

      await manager.close("close_test");
      expect(manager.hasConnection("close_test")).toBe(false);
    });

    it("应该关闭所有连接", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("close_all_1", config);
      await manager.connect("close_all_2", config);

      expect(manager.hasConnection("close_all_1")).toBe(true);
      expect(manager.hasConnection("close_all_2")).toBe(true);

      await manager.closeAll();

      expect(manager.hasConnection("close_all_1")).toBe(false);
      expect(manager.hasConnection("close_all_2")).toBe(false);
    });

    it("应该在关闭不存在的连接时不报错", async () => {
      // 直接调用，如果不抛出错误则测试通过
      await manager.close("nonexistent");
      expect(true).toBe(true); // 如果没有抛出错误，测试通过
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      expect(manager.hasConnection("has_test")).toBe(false);

      await manager.connect("has_test", config);
      expect(manager.hasConnection("has_test")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("default", config);
      expect(manager.hasConnection()).toBe(true);
    });
  });

  describe("getConnectionNames", () => {
    it("应该返回所有连接名称", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      await manager.connect("name_test_1", config);
      await manager.connect("name_test_2", config);

      const names = manager.getConnectionNames();
      expect(names).toContain("name_test_1");
      expect(names).toContain("name_test_2");
    });

    it("应该在无连接时返回空数组", async () => {
      await manager.closeAll();
      const names = manager.getConnectionNames();
      expect(names).toEqual([]);
    });
  });

  describe("createAdapter", () => {
    it("应该为 MySQL 创建适配器", async () => {
      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      const status = await manager.connect("mysql_adapter", config);
      expect(status.type).toBe("mysql");
    });
  });

  describe("setAdapterFactory", () => {
    it("应该设置适配器工厂", async () => {
      const { MySQLAdapter } = await import("../../src/adapters/mysql.ts");
      const factory = (type: string) => {
        if (type === "mysql") {
          return new MySQLAdapter();
        }
        throw new Error(`Unsupported type: ${type}`);
      };

      manager.setAdapterFactory(factory as any);

      const mysqlHost = getEnvWithDefault("MYSQL_HOST", "localhost");
      const mysqlPort = parseInt(getEnvWithDefault("MYSQL_PORT", "3306"));
      const mysqlDatabase = getEnvWithDefault("MYSQL_DATABASE", "test");
      const mysqlUser = getEnvWithDefault("MYSQL_USER", "root");
      const mysqlPassword = getEnvWithDefault("MYSQL_PASSWORD", "");

      const config: DatabaseConfig = {
        type: "mysql",
        connection: {
          host: mysqlHost,
          port: mysqlPort,
          database: mysqlDatabase,
          username: mysqlUser,
          password: mysqlPassword,
        },
      };

      const status = await manager.connect("factory_test", config);

      expect(status.type).toBe("mysql");
      expect(status.connected).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
