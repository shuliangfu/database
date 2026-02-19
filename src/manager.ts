/**
 * 数据库管理器
 * 管理多个数据库连接
 * 支持服务容器集成，可通过依赖注入方式管理
 */

import { $tr } from "./i18n.ts";
import { MongoDBAdapter } from "./adapters/mongodb.ts";
import { MySQLAdapter } from "./adapters/mysql.ts";
import { PostgreSQLAdapter } from "./adapters/postgresql.ts";
import { SQLiteAdapter } from "./adapters/sqlite.ts";
import type {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseType,
  MongoConfig,
  MySQLConfig,
  PostgreSQLConfig,
  SQLiteConfig,
} from "./types.ts";

// 导入服务容器类型（可选依赖）
import type { ServiceContainer } from "@dreamer/service";

/**
 * 数据库管理器配置选项
 */
export interface DatabaseManagerOptions {
  /** 管理器名称（用于服务容器注册） */
  name?: string;
}

/**
 * 连接状态信息
 */
export interface ConnectionStatus {
  /** 连接名称 */
  name: string;
  /** 数据库类型 */
  type: DatabaseType;
  /** 是否已连接 */
  connected: boolean;
  /** 连接配置中的主机地址 */
  host?: string;
  /** 连接配置中的数据库名或文件路径 */
  database?: string;
  /** SQLite 文件路径 */
  filename?: string;
}

/**
 * 适配器工厂函数类型
 */
export type AdapterFactory = (type: DatabaseType) => DatabaseAdapter;

/**
 * 数据库管理器类
 * 支持服务容器集成，可通过依赖注入方式管理
 */
export class DatabaseManager {
  /** 数据库适配器映射 */
  private adapters: Map<string, DatabaseAdapter> = new Map();
  /** 适配器工厂函数 */
  private adapterFactory?: AdapterFactory;
  /** 服务容器引用 */
  private container?: ServiceContainer;
  /** 管理器名称 */
  private readonly managerName: string;

  /**
   * 创建数据库管理器
   * @param options 配置选项
   */
  constructor(options?: DatabaseManagerOptions) {
    this.managerName = options?.name || "default";
  }

  /**
   * 获取管理器名称
   * @returns 管理器名称
   */
  getName(): string {
    return this.managerName;
  }

  /**
   * 设置服务容器
   * 将管理器注册到服务容器中
   * @param container 服务容器实例
   * @returns 当前管理器实例（链式调用）
   */
  setContainer(container: ServiceContainer): this {
    this.container = container;
    // 注册自身到容器
    const serviceName = this.managerName === "default"
      ? "databaseManager"
      : `databaseManager:${this.managerName}`;
    container.registerSingleton(serviceName, () => this);
    return this;
  }

  /**
   * 获取服务容器
   * @returns 服务容器实例或 undefined
   */
  getContainer(): ServiceContainer | undefined {
    return this.container;
  }

  /**
   * 从服务容器获取数据库管理器
   * @param container 服务容器实例
   * @param name 管理器名称（默认：default）
   * @returns 数据库管理器实例
   */
  static fromContainer(
    container: ServiceContainer,
    name?: string,
  ): DatabaseManager {
    const serviceName = !name || name === "default"
      ? "databaseManager"
      : `databaseManager:${name}`;
    return container.get<DatabaseManager>(serviceName);
  }

  /**
   * 设置适配器工厂（用于测试）
   * @param factory 适配器工厂函数
   */
  setAdapterFactory(factory: AdapterFactory): void {
    this.adapterFactory = factory;
  }

  /**
   * 连接数据库
   * @param name 连接名称（默认为 'default'）
   * @param config 数据库配置
   * @returns 连接状态信息
   */
  async connect(
    name: string = "default",
    config: DatabaseConfig,
  ): Promise<ConnectionStatus> {
    const adapter = this.adapterFactory
      ? this.adapterFactory(config.adapter)
      : this.createAdapter(config.adapter);
    await adapter.connect(config);
    this.adapters.set(name, adapter);

    // 返回连接状态（根据配置适配器提取相应字段）
    let host: string | undefined;
    let database: string | undefined;
    let filename: string | undefined;

    if (config.adapter === "postgresql") {
      const pgConfig = config as PostgreSQLConfig;
      host = pgConfig.connection.host;
      database = pgConfig.connection.database;
    } else if (config.adapter === "mysql") {
      const mysqlConfig = config as MySQLConfig;
      host = mysqlConfig.connection.host;
      database = mysqlConfig.connection.database;
    } else if (config.adapter === "mongodb") {
      const mongoConfig = config as MongoConfig;
      host = mongoConfig.connection.host;
      database = mongoConfig.connection.database;
    } else if (config.adapter === "sqlite") {
      const sqliteConfig = config as SQLiteConfig;
      filename = sqliteConfig.connection.filename;
    }

    return {
      name,
      type: config.adapter,
      connected: adapter.isConnected(),
      host,
      database,
      filename,
    };
  }

  /**
   * 获取数据库连接
   * @param name 连接名称（默认为 'default'）
   * @returns 数据库适配器实例
   */
  getConnection(name: string = "default"): DatabaseAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error($tr("error.connectionNotFound", { name }));
    }
    return adapter;
  }

  /**
   * 创建适配器实例
   * @param type 数据库类型
   * @returns 数据库适配器实例
   */
  private createAdapter(type: DatabaseType): DatabaseAdapter {
    switch (type) {
      case "mongodb":
        return new MongoDBAdapter();
      case "postgresql":
        return new PostgreSQLAdapter();
      case "mysql":
        return new MySQLAdapter();
      case "sqlite":
        return new SQLiteAdapter();
      default:
        throw new Error($tr("error.unsupportedDatabaseType", { type }));
    }
  }

  /**
   * 关闭指定连接
   * @param name 连接名称（如果不提供，则关闭所有连接）
   */
  async close(name?: string): Promise<void> {
    if (name) {
      const adapter = this.adapters.get(name);
      if (adapter) {
        await adapter.close();
        this.adapters.delete(name);
      }
    } else {
      await this.closeAll();
    }
  }

  /**
   * 关闭所有连接
   * 确保所有连接完全关闭，避免连接泄漏
   */
  async closeAll(): Promise<void> {
    // 串行关闭所有连接，确保每个连接都完全关闭
    // 并行关闭可能导致连接池竞争，导致连接泄漏
    const adapters = Array.from(this.adapters.values());

    for (let i = 0; i < adapters.length; i++) {
      const adapter = adapters[i];
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.adapters.clear();
  }

  /**
   * 检查连接是否存在
   * @param name 连接名称
   * @returns 是否存在
   */
  hasConnection(name: string = "default"): boolean {
    return this.adapters.has(name);
  }

  /**
   * 获取所有连接名称
   * @returns 连接名称数组
   */
  getConnectionNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * 创建数据库管理器的工厂函数
 * @param options 管理器配置选项
 * @param container 服务容器实例（可选）
 * @returns 数据库管理器实例
 *
 * @example
 * ```typescript
 * import { createDatabaseManager } from "@dreamer/database";
 * import { ServiceContainer } from "@dreamer/service";
 *
 * const container = new ServiceContainer();
 *
 * // 创建并注册到服务容器
 * const dbManager = createDatabaseManager({ name: "main" }, container);
 *
 * // 之后可以从容器获取
 * const dbFromContainer = DatabaseManager.fromContainer(container, "main");
 * ```
 */
export function createDatabaseManager(
  options?: DatabaseManagerOptions,
  container?: ServiceContainer,
): DatabaseManager {
  const manager = new DatabaseManager(options);
  if (container) {
    manager.setContainer(container);
  }
  return manager;
}
