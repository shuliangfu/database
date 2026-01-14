/**
 * 数据库管理器
 * 管理多个数据库连接
 */

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
 */
export class DatabaseManager {
  private adapters: Map<string, DatabaseAdapter> = new Map();
  private adapterFactory?: AdapterFactory;

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
      ? this.adapterFactory(config.type)
      : this.createAdapter(config.type);
    await adapter.connect(config);
    this.adapters.set(name, adapter);

    // 返回连接状态（根据配置类型提取相应字段）
    let host: string | undefined;
    let database: string | undefined;
    let filename: string | undefined;

    if (config.type === "postgresql") {
      const pgConfig = config as PostgreSQLConfig;
      host = pgConfig.connection.host;
      database = pgConfig.connection.database;
    } else if (config.type === "mysql") {
      const mysqlConfig = config as MySQLConfig;
      host = mysqlConfig.connection.host;
      database = mysqlConfig.connection.database;
    } else if (config.type === "mongodb") {
      const mongoConfig = config as MongoConfig;
      host = mongoConfig.connection.host;
      database = mongoConfig.connection.database;
    } else if (config.type === "sqlite") {
      const sqliteConfig = config as SQLiteConfig;
      filename = sqliteConfig.connection.filename;
    }

    return {
      name,
      type: config.type,
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
      throw new Error(
        `Database connection "${name}" not found. Please connect first.`,
      );
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
        throw new Error(`Unsupported database type: ${type}`);
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
   */
  async closeAll(): Promise<void> {
    // 并行关闭所有连接以提高效率
    const closePromises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.close()
    );
    await Promise.allSettled(closePromises);
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
