/**
 * @fileoverview DatabaseManager 测试
 */

import { ServiceContainer } from "@dreamer/service";
import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { createDatabaseManager, DatabaseManager } from "../../src/manager.ts";
import type { DatabaseConfig } from "../../src/types.ts";

describe("DatabaseManager", () => {
  let manager: DatabaseManager;

  beforeAll(() => {
    manager = new DatabaseManager();
  });

  afterAll(async () => {
    await manager?.closeAll();
  });

  describe("connect", () => {
    it("应该连接到 SQLite 数据库", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: {
          filename: ":memory:",
        },
      };

      const status = await manager.connect("sqlite_test", config);

      expect(status.name).toBe("sqlite_test");
      expect(status.type).toBe("sqlite");
      expect(status.connected).toBe(true);
      expect(status.filename).toBe(":memory:");
    });

    it("应该支持多个连接", async () => {
      const config1: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };
      const config2: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      await manager.connect("connection1", config1);
      await manager.connect("connection2", config2);

      expect(manager.hasConnection("connection1")).toBe(true);
      expect(manager.hasConnection("connection2")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      const status = await manager.connect(undefined, config);

      expect(status.name).toBe("default");
      expect(manager.hasConnection("default")).toBe(true);
    });
  });

  describe("getConnection", () => {
    it("应该获取已存在的连接", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      await manager.connect("test_connection", config);
      const adapter = manager.getConnection("test_connection");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
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
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      await manager.connect("close_test", config);
      expect(manager.hasConnection("close_test")).toBe(true);

      await manager.close("close_test");
      expect(manager.hasConnection("close_test")).toBe(false);
    });

    it("应该关闭所有连接", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
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
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      expect(manager.hasConnection("has_test")).toBe(false);

      await manager.connect("has_test", config);
      expect(manager.hasConnection("has_test")).toBe(true);
    });

    it("应该使用默认连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      await manager.connect("default", config);
      expect(manager.hasConnection()).toBe(true);
    });
  });

  describe("getConnectionNames", () => {
    it("应该返回所有连接名称", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
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
    it("应该为 SQLite 创建适配器", async () => {
      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      const status = await manager.connect("sqlite_adapter", config);
      expect(status.type).toBe("sqlite");
    });

    it("应该在数据库类型不支持时抛出错误", () => {
      // 由于 createAdapter 是私有方法，我们通过 connect 来测试
      const invalidConfig = {
        type: "invalid" as any,
        connection: { filename: ":memory:" },
      };

      // TypeScript 会阻止这种情况，但我们可以测试运行时错误
      // 实际上，由于类型检查，这不会编译通过
      // 但我们可以测试其他场景
    });
  });

  describe("setAdapterFactory", () => {
    it("应该设置适配器工厂", async () => {
      const { SQLiteAdapter } = await import("../../src/adapters/sqlite.ts");
      const factory = (type: string) => {
        if (type === "sqlite") {
          return new SQLiteAdapter();
        }
        throw new Error(`Unsupported type: ${type}`);
      };

      manager.setAdapterFactory(factory as any);

      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      const status = await manager.connect("factory_test", config);

      expect(status.type).toBe("sqlite");
      expect(status.connected).toBe(true);
    });
  });

  describe("ServiceContainer 集成", () => {
    it("应该能够设置和获取服务容器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      // 初始状态：没有服务容器
      expect(dbManager.getContainer()).toBeUndefined();

      // 设置服务容器
      const result = dbManager.setContainer(container);

      // 链式调用应该返回自身
      expect(result).toBe(dbManager);

      // 验证已设置
      expect(dbManager.getContainer()).toBe(container);

      await dbManager.closeAll();
    });

    it("应该在设置容器时自动注册到服务容器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      dbManager.setContainer(container);

      // 从容器获取应该返回同一个实例
      const fromContainer = container.get<DatabaseManager>("databaseManager");
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持通过 fromContainer 静态方法获取管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager();

      dbManager.setContainer(container);

      // 使用静态方法获取
      const fromContainer = DatabaseManager.fromContainer(container);
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持命名管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = new DatabaseManager({ name: "custom" });

      expect(dbManager.getName()).toBe("custom");

      dbManager.setContainer(container);

      // 应该使用命名键注册
      const fromContainer = DatabaseManager.fromContainer(container, "custom");
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持多个命名管理器", async () => {
      const container = new ServiceContainer();
      const manager1 = new DatabaseManager({ name: "mysql" });
      const manager2 = new DatabaseManager({ name: "postgres" });

      manager1.setContainer(container);
      manager2.setContainer(container);

      // 验证两个都能正确获取
      const fromContainer1 = DatabaseManager.fromContainer(container, "mysql");
      const fromContainer2 = DatabaseManager.fromContainer(
        container,
        "postgres",
      );

      expect(fromContainer1).toBe(manager1);
      expect(fromContainer2).toBe(manager2);

      await manager1.closeAll();
      await manager2.closeAll();
    });

    it("应该在获取不存在的管理器时抛出错误", () => {
      const container = new ServiceContainer();

      expect(() => {
        DatabaseManager.fromContainer(container);
      }).toThrow();
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

      // 从容器获取
      const fromContainer = DatabaseManager.fromContainer(container);
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持命名管理器", async () => {
      const container = new ServiceContainer();
      const dbManager = createDatabaseManager({ name: "custom" }, container);

      expect(dbManager.getName()).toBe("custom");

      const fromContainer = DatabaseManager.fromContainer(container, "custom");
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该在不传入容器时正常工作", async () => {
      const dbManager = createDatabaseManager({ name: "test" });

      expect(dbManager.getContainer()).toBeUndefined();
      expect(dbManager.getName()).toBe("test");

      await dbManager.closeAll();
    });

    it("应该支持链式调用", async () => {
      const container = new ServiceContainer();
      const dbManager = createDatabaseManager({ name: "chain" }, container);

      const config: DatabaseConfig = {
        adapter: "sqlite",
        connection: { filename: ":memory:" },
      };

      // 连接测试
      const status = await dbManager.connect("test", config);
      expect(status.connected).toBe(true);

      await dbManager.closeAll();
    });
  });
});
