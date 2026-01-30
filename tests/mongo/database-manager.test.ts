/**
 * @fileoverview DatabaseManager 测试
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { ServiceContainer } from "@dreamer/service";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { createDatabaseManager, DatabaseManager } from "../../src/manager.ts";
import type { DatabaseConfig } from "../../src/types.ts";

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

/**
 * 创建 MongoDB 配置（包含副本集设置）
 */
function createMongoConfig(): DatabaseConfig {
  const mongoHost = getEnvWithDefault("MONGODB_HOST", "localhost");
  const mongoPort = parseInt(getEnvWithDefault("MONGODB_PORT", "27017"));
  const mongoDatabase = getEnvWithDefault("MONGODB_DATABASE", "test");
  const replicaSet = getEnvWithDefault("MONGODB_REPLICA_SET", "rs0");
  const directConnection = getEnvWithDefault(
    "MONGODB_DIRECT_CONNECTION",
    "true",
  ) === "true";

  return {
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
    it("应该连接到 MongoDB 数据库", async () => {
      const config = createMongoConfig();

      const status = await manager.connect("mongo_test", config);

      expect(status.name).toBe("mongo_test");
      expect(status.type).toBe("mongodb");
      expect(status.connected).toBe(true);
    });

    it("应该支持多个连接", async () => {
      const config1 = createMongoConfig();
      const config2 = createMongoConfig();

      await manager.connect("connection1", config1);
      await manager.connect("connection2", config2);

      expect(manager.hasConnection("connection1")).toBe(true);
      expect(manager.hasConnection("connection2")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config = createMongoConfig();

      const status = await manager.connect(undefined, config);

      expect(status.name).toBe("default");
      expect(manager.hasConnection("default")).toBe(true);
    });
  });

  describe("getConnection", () => {
    it("应该获取已存在的连接", async () => {
      const config = createMongoConfig();

      await manager.connect("test_connection", config);
      const adapter = manager.getConnection("test_connection");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config = createMongoConfig();

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
      const config = createMongoConfig();

      await manager.connect("close_test", config);
      expect(manager.hasConnection("close_test")).toBe(true);

      await manager.close("close_test");
      expect(manager.hasConnection("close_test")).toBe(false);
    });

    it("应该关闭所有连接", async () => {
      const config = createMongoConfig();

      await manager.connect("close_all_1", config);
      await manager.connect("close_all_2", config);

      expect(manager.hasConnection("close_all_1")).toBe(true);
      expect(manager.hasConnection("close_all_2")).toBe(true);

      await manager.closeAll();

      expect(manager.hasConnection("close_all_1")).toBe(false);
      expect(manager.hasConnection("close_all_2")).toBe(false);
    });

    it("应该在关闭不存在的连接时不报错", async () => {
      await manager.close("nonexistent");
      expect(true).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      const config = createMongoConfig();

      expect(manager.hasConnection("has_test")).toBe(false);

      await manager.connect("has_test", config);
      expect(manager.hasConnection("has_test")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config = createMongoConfig();

      await manager.connect("default", config);
      expect(manager.hasConnection()).toBe(true);
    });
  });

  describe("getConnectionNames", () => {
    it("应该返回所有连接名称", async () => {
      const config = createMongoConfig();

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
    it("应该为 MongoDB 创建适配器", async () => {
      const config = createMongoConfig();

      const status = await manager.connect("mongo_adapter", config);
      expect(status.type).toBe("mongodb");
    });
  });

  describe("setAdapterFactory", () => {
    it("应该设置适配器工厂", async () => {
      const { MongoDBAdapter } = await import("../../src/adapters/mongodb.ts");
      const factory = (type: string) => {
        if (type === "mongodb") {
          return new MongoDBAdapter();
        }
        throw new Error(`Unsupported type: ${type}`);
      };

      manager.setAdapterFactory(factory as any);

      const config = createMongoConfig();

      const status = await manager.connect("factory_test", config);

      expect(status.type).toBe("mongodb");
      expect(status.connected).toBe(true);
    });
  });

  describe("ServiceContainer 集成", () => {
    it("应该能够设置和获取服务容器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      expect(dbManager.getContainer()).toBeUndefined();

      const result = dbManager.setContainer(container);
      expect(result).toBe(dbManager);
      expect(dbManager.getContainer()).toBe(container);

      await dbManager.closeAll();
    });

    it("应该在设置容器时自动注册到服务容器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      dbManager.setContainer(container);

      const fromContainer = container.get<DatabaseManager>("databaseManager");
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持通过 fromContainer 静态方法获取管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      dbManager.setContainer(container);

      const fromContainer = DatabaseManager.fromContainer(container);
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持命名管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager({ name: "mongodb" });

      expect(dbManager.getName()).toBe("mongodb");

      dbManager.setContainer(container);

      const fromContainer = DatabaseManager.fromContainer(container, "mongodb");
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持多个命名管理器", async () => {
      const container = new ServiceContainer();
      const manager1 = new DatabaseManager({ name: "primary" });
      const manager2 = new DatabaseManager({ name: "analytics" });

      manager1.setContainer(container);
      manager2.setContainer(container);

      expect(DatabaseManager.fromContainer(container, "primary")).toBe(
        manager1,
      );
      expect(DatabaseManager.fromContainer(container, "analytics")).toBe(
        manager2,
      );

      await manager1.closeAll();
      await manager2.closeAll();
    });

    it("应该在获取不存在的管理器时抛出错误", () => {
      const container = new ServiceContainer();
      expect(() => DatabaseManager.fromContainer(container)).toThrow();
    });

    it("默认名称应该是 default", async () => {
      const dbManager = new DatabaseManager();
      expect(dbManager.getName()).toBe("default");
      await dbManager.closeAll();
    });
  });

  describe("createDatabaseManager 工厂函数", () => {
    it("应该创建数据库管理器", async () => {
      const dbManager = createDatabaseManager();
      expect(dbManager).toBeInstanceOf(DatabaseManager);
      expect(dbManager.getName()).toBe("default");
      await dbManager.closeAll();
    });

    it("应该支持传入服务容器", async () => {
      const container = new ServiceContainer();
      const dbManager = createDatabaseManager(undefined, container);

      expect(dbManager.getContainer()).toBe(container);
      expect(DatabaseManager.fromContainer(container)).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持命名管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = createDatabaseManager({ name: "custom" }, container);

      expect(dbManager.getName()).toBe("custom");
      expect(DatabaseManager.fromContainer(container, "custom")).toBe(
        dbManager,
      );

      await dbManager.closeAll();
    });

    it("应该在不传入容器时正常工作", async () => {
      const dbManager = createDatabaseManager({ name: "test" });
      expect(dbManager.getContainer()).toBeUndefined();
      await dbManager.closeAll();
    });

    it("应该支持连接数据库", async () => {
      const container = new ServiceContainer();
      const dbManager = createDatabaseManager({ name: "mongo" }, container);

      const config = createMongoConfig();

      const status = await dbManager.connect("test", config);
      expect(status.connected).toBe(true);

      await dbManager.closeAll();
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
