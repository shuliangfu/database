/**
 * @fileoverview DatabaseManager 测试
 */

import { ServiceContainer } from "@dreamer/service";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { createDatabaseManager, DatabaseManager } from "../../src/manager.ts";
import { createPostgresConfig } from "./postgres-test-utils.ts";

describe("DatabaseManager", () => {
  let manager: DatabaseManager;

  beforeAll(() => {
    manager = new DatabaseManager();
  });

  afterAll(async () => {
    if (manager) {
      await manager.closeAll();
    }
  });

  // 每个测试后清理连接，避免连接泄漏
  afterEach(async () => {
    if (manager) {
      // 获取所有连接名称
      const connectionNames = manager.getConnectionNames();
      // 关闭所有连接
      for (const name of connectionNames) {
        try {
          await manager.close(name);
        } catch {
          // 忽略关闭错误
        }
      }
      // 等待连接池释放连接，增加等待时间确保连接完全释放
      // PostgreSQL 服务器端需要时间释放连接，增加等待时间
    }
  });

  describe("connect", () => {
    it("应该连接到 PostgreSQL 数据库", async () => {
      const status = await manager.connect("postgres_test", createPostgresConfig());

      expect(status.name).toBe("postgres_test");
      expect(status.type).toBe("postgresql");
      expect(status.connected).toBe(true);
    }, { timeout: 10000 });

    it("应该支持多个连接", async () => {
      const config = createPostgresConfig();
      await manager.connect("connection1", config);
      await manager.connect("connection2", config);

      expect(manager.hasConnection("connection1")).toBe(true);
      expect(manager.hasConnection("connection2")).toBe(true);
    }, { timeout: 15000 });

    it("应该使用默认连接名称", async () => {
      const status = await manager.connect(undefined, createPostgresConfig());

      expect(status.name).toBe("default");
      expect(manager.hasConnection("default")).toBe(true);
    }, { timeout: 10000 });
  });

  describe("getConnection", () => {
    it("应该获取已存在的连接", async () => {
      await manager.connect("test_connection", createPostgresConfig());
      const adapter = manager.getConnection("test_connection");

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 10000 });

    it("应该使用默认连接名称", async () => {
      await manager.connect("default", createPostgresConfig());
      const adapter = manager.getConnection();

      expect(adapter).toBeTruthy();
      expect(adapter.isConnected()).toBe(true);
    }, { timeout: 10000 });

    it("应该在连接不存在时抛出错误", () => {
      expect(() => {
        manager.getConnection("nonexistent");
      }).toThrow();
    });
  });

  describe("close", () => {
    it("应该关闭指定连接", async () => {
      await manager.connect("close_test", createPostgresConfig());
      expect(manager.hasConnection("close_test")).toBe(true);

      await manager.close("close_test");
      expect(manager.hasConnection("close_test")).toBe(false);
    }, { timeout: 10000 });

    it("应该关闭所有连接", async () => {
      const config = createPostgresConfig();
      await manager.connect("close_all_1", config);
      await manager.connect("close_all_2", config);

      expect(manager.hasConnection("close_all_1")).toBe(true);
      expect(manager.hasConnection("close_all_2")).toBe(true);

      await manager.closeAll();

      expect(manager.hasConnection("close_all_1")).toBe(false);
      expect(manager.hasConnection("close_all_2")).toBe(false);
    }, { timeout: 10000 });

    it("应该在关闭不存在的连接时不报错", async () => {
      await manager.close("nonexistent");
      expect(true).toBe(true);
    });
  });

  describe("hasConnection", () => {
    it("应该检查连接是否存在", async () => {
      expect(manager.hasConnection("has_test")).toBe(false);

      await manager.connect("has_test", createPostgresConfig());
      expect(manager.hasConnection("has_test")).toBe(true);
    }, { timeout: 10000 });

    it("应该使用默认连接名称", async () => {
      await manager.connect("default", createPostgresConfig());
      expect(manager.hasConnection()).toBe(true);
    }, { timeout: 10000 });
  });

  describe("getConnectionNames", () => {
    it("应该返回所有连接名称", async () => {
      // 先清理可能存在的连接
      await manager.closeAll();

      const config = createPostgresConfig();
      // 创建两个连接
      await manager.connect("name_test_1", config);
      await manager.connect("name_test_2", config);

      // 验证连接已创建
      expect(manager.hasConnection("name_test_1")).toBe(true);
      expect(manager.hasConnection("name_test_2")).toBe(true);

      // 获取所有连接名称
      const names = manager.getConnectionNames();

      // 验证返回的连接名称
      expect(names.length).toBeGreaterThanOrEqual(2);
      expect(names).toContain("name_test_1");
      expect(names).toContain("name_test_2");
    }, { timeout: 10000 });

    it("应该在无连接时返回空数组", async () => {
      await manager.closeAll();
      const names = manager.getConnectionNames();
      expect(names).toEqual([]);
    });
  });

  describe("createAdapter", () => {
    it("应该为 PostgreSQL 创建适配器", async () => {
      const status = await manager.connect("postgres_adapter", createPostgresConfig());
      expect(status.type).toBe("postgresql");
    }, { timeout: 10000 });
  });

  describe("setAdapterFactory", () => {
    it("应该设置适配器工厂", async () => {
      const { PostgreSQLAdapter } = await import(
        "../../src/adapters/postgresql.ts"
      );
      const factory = (type: string) => {
        if (type === "postgresql") {
          return new PostgreSQLAdapter();
        }
        throw new Error(`Unsupported type: ${type}`);
      };

      manager.setAdapterFactory(factory as any);

      const status = await manager.connect("factory_test", createPostgresConfig());

      expect(status.type).toBe("postgresql");
      expect(status.connected).toBe(true);
    }, { timeout: 10000 });
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
      const dbManager = new DatabaseManager({ name: "postgres" });

      expect(dbManager.getName()).toBe("postgres");

      dbManager.setContainer(container);

      const fromContainer = DatabaseManager.fromContainer(
        container,
        "postgres",
      );
      expect(fromContainer).toBe(dbManager);

      await dbManager.closeAll();
    });

    it("应该支持多个命名管理器", async () => {
      const container = new ServiceContainer();
      const manager1 = new DatabaseManager({ name: "primary" });
      const manager2 = new DatabaseManager({ name: "replica" });

      manager1.setContainer(container);
      manager2.setContainer(container);

      expect(DatabaseManager.fromContainer(container, "primary")).toBe(
        manager1,
      );
      expect(DatabaseManager.fromContainer(container, "replica")).toBe(
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
      const dbManager = createDatabaseManager({ name: "pg" }, container);

      const status = await dbManager.connect("test", createPostgresConfig());
      expect(status.connected).toBe(true);

      await dbManager.closeAll();
    }, { timeout: 10000 });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
