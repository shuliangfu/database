/**
 * MongoDB 数据库适配器
 *
 * @module
 */

import { createLogger } from "@dreamer/logger";
import { type ClientSession, type Db, MongoClient } from "mongodb";
import {
  createConnectionError,
  createExecuteError,
  createQueryError,
  createTransactionError,
  DatabaseErrorCode,
} from "../errors.ts";
import type { DatabaseAdapter, DatabaseConfig, MongoConfig } from "../types.ts";
import {
  BaseAdapter,
  type HealthCheckResult,
  type PoolStatus,
} from "./base.ts";

/**
 * MongoDB 适配器实现
 * 注意：MongoDB 使用文档数据库，query 和 execute 方法的语义与 SQL 数据库不同
 */
export class MongoDBAdapter extends BaseAdapter {
  protected client: MongoClient | null = null;
  protected db: Db | null = null;
  private logger = createLogger({
    level: "warn",
    format: "text",
    tags: ["database", "mongodb"],
  });

  /**
   * 连接 MongoDB 数据库
   * @param config MongoDB 数据库配置
   * @param retryCount 重试次数（内部使用）
   */
  async connect(
    config: MongoConfig | DatabaseConfig,
    retryCount: number = 0,
  ): Promise<void> {
    // 类型守卫：确保是 MongoDB 配置
    if (config.type !== "mongodb") {
      throw new Error("Invalid config type for MongoDB adapter");
    }

    const mongoConfig = config as MongoConfig;
    const mongoOptions = mongoConfig.mongoOptions as
      | (typeof mongoConfig.mongoOptions & {
        maxRetries?: number;
        retryDelay?: number;
        directConnection?: boolean;
      })
      | undefined;
    const maxRetries = mongoOptions?.maxRetries || 3;
    const retryDelay = mongoOptions?.retryDelay || 1000;

    try {
      this.validateConfig(config);
      this.config = config;

      const { host, port, database, username, password, authSource } =
        mongoConfig.connection;

      // 构建连接 URL
      let url: string;
      const urlParams: string[] = [];

      // 如果配置了副本集名称，添加到连接参数
      if (mongoOptions?.replicaSet) {
        urlParams.push(`replicaSet=${mongoOptions.replicaSet}`);
      }

      if (username && password) {
        url = `mongodb://${username}:${password}@${host || "localhost"}:${
          port || 27017
        }/${database || ""}`;
        if (authSource) {
          urlParams.push(`authSource=${authSource}`);
        }
      } else {
        url = `mongodb://${host || "localhost"}:${port || 27017}/${
          database || ""
        }`;
      }

      // 添加查询参数
      if (urlParams.length > 0) {
        url += `?${urlParams.join("&")}`;
      }

      // 连接选项（与 MongoDB 官方驱动配置对应）
      const clientOptions: any = {
        // 默认选项
        serverSelectionTimeoutMS: mongoOptions?.serverSelectionTimeoutMS ||
          30000,
        connectTimeoutMS: mongoOptions?.connectTimeoutMS ?? 5000, // 连接超时 5 秒
        socketTimeoutMS: mongoOptions?.socketTimeoutMS ?? 5000, // Socket 超时 5 秒
        // directConnection 必须手动设置为 true 才启用，默认不开启
        directConnection: mongoOptions?.directConnection ?? false,
      };

      if (mongoOptions?.authSource) {
        clientOptions.authSource = mongoOptions.authSource;
      }

      if (mongoOptions?.replicaSet) {
        clientOptions.replicaSet = mongoOptions.replicaSet;
      }

      if (mongoOptions?.maxPoolSize) {
        clientOptions.maxPoolSize = mongoOptions.maxPoolSize;
      }

      if (mongoOptions?.minPoolSize) {
        clientOptions.minPoolSize = mongoOptions.minPoolSize;
      }

      this.client = new MongoClient(url, clientOptions);

      // 使用 Promise.race 确保连接不会无限等待
      // 如果 serverSelectionTimeoutMS 没有生效，我们添加额外的超时保护
      const connectPromise = this.client.connect();
      const connectTimeout = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("MongoDB connection timeout")),
          (mongoOptions?.serverSelectionTimeoutMS || 30000) + 5000, // 比 serverSelectionTimeoutMS 多 5 秒
        );
      });

      try {
        await Promise.race([connectPromise, connectTimeout]);
        this.db = this.client.db(database);
        this.connected = true;
      } catch (connectError) {
        // 如果连接失败，清理客户端
        try {
          await this.client.close();
        } catch {
          // 忽略关闭错误
        }
        this.client = null;
        throw connectError;
      }
    } catch (error) {
      // 自动重连机制
      if (retryCount < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (retryCount + 1))
        );
        return await this.connect(config, retryCount + 1);
      }
      throw createConnectionError(
        `MongoDB connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: DatabaseErrorCode.CONNECTION_FAILED,
          originalError: error instanceof Error
            ? error
            : new Error(String(error)),
        },
      );
    }
  }

  /**
   * 检查连接并自动重连
   */
  protected async ensureConnection(): Promise<void> {
    if (!this.connected || !this.client) {
      if (this.config) {
        await this.connect(this.config);
      } else {
        throw createConnectionError(
          "Database not connected and no config available for reconnection",
          {
            code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
          },
        );
      }
    }

    // 定期健康检查
    const now = Date.now();
    if (
      !this.lastHealthCheck ||
      now - this.lastHealthCheck.getTime() > this.healthCheckInterval
    ) {
      const health = await this.healthCheck();
      if (!health.healthy) {
        // 连接不健康，尝试重连
        if (this.config) {
          await this.connect(this.config);
        }
      }
    }
  }

  /**
   * 执行查询（MongoDB 使用集合和查询对象）
   * @param collection 集合名称
   * @param filter 查询过滤器（可选）
   * @param options 查询选项（可选，如果包含 pipeline 则使用聚合管道）
   */
  async query(
    collection: string,
    filter: any = {},
    options: any = {},
  ): Promise<any[]> {
    await this.ensureConnection();
    if (!this.db) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();
    let sql: string = `db.${collection}.query`;
    let result: any[];

    try {
      // 如果 options 包含 pipeline，使用聚合管道
      if (options.pipeline && Array.isArray(options.pipeline)) {
        sql = `db.${collection}.aggregate(${JSON.stringify(options.pipeline)})`;
        const cursor = this.db.collection(collection).aggregate(
          options.pipeline,
        );
        result = await cursor.toArray();
      } else {
        // 普通查询
        sql = `db.${collection}.find(${JSON.stringify(filter)}, ${
          JSON.stringify(options)
        })`;
        result = await this.db.collection(collection).find(filter, options)
          .toArray();
      }

      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        this.queryLogger.log("query", sql, [filter, options], duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        this.queryLogger.log(
          "query",
          sql,
          [filter, options],
          duration,
          originalError,
        );
      }
      throw createQueryError(`MongoDB query error: ${originalError.message}`, {
        code: DatabaseErrorCode.QUERY_FAILED,
        sql,
        params: [filter, options],
        originalError,
      });
    }
  }

  /**
   * 执行操作（插入、更新、删除）
   * @param operation 操作类型：'insert', 'insertMany', 'update', 'updateMany', 'delete', 'deleteMany'
   * @param collection 集合名称（作为第二个参数）
   * @param data 操作数据（作为第三个参数）
   */
  async execute(
    operation: string,
    collection?: string | any[],
    data?: any,
  ): Promise<any> {
    await this.ensureConnection();
    if (!this.db) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    // MongoDB 适配器需要 collection 和 data 参数
    if (typeof collection !== "string") {
      throw createExecuteError(
        "MongoDB execute requires collection name as second parameter",
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
        },
      );
    }
    if (data === undefined) {
      throw createExecuteError(
        "MongoDB execute requires data as third parameter",
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
        },
      );
    }

    const startTime = Date.now();
    const sql = `db.${collection}.${operation}(${JSON.stringify(data)})`;

    try {
      const coll = this.db.collection(collection);
      let result: any;

      switch (operation) {
        case "insert":
          result = await coll.insertOne(data);
          break;
        case "insertMany":
          result = await coll.insertMany(data);
          break;
        case "update": {
          // data.update 可能已经包含 $set 等操作符，直接使用
          // 如果没有操作符，则包装为 $set
          const updateDoc = data.update && typeof data.update === "object" &&
              ("$set" in data.update || "$unset" in data.update ||
                "$inc" in data.update || "$push" in data.update ||
                "$pull" in data.update || "$addToSet" in data.update ||
                "$pop" in data.update || "$min" in data.update ||
                "$max" in data.update || "$mul" in data.update)
            ? data.update
            : { $set: data.update };
          const options = data.options || {};
          result = await coll.updateOne(data.filter, updateDoc, options);
          break;
        }
        case "updateMany": {
          // data.update 可能已经包含 $set 等操作符，直接使用
          // 如果没有操作符，则包装为 $set
          const updateManyDoc =
            data.update && typeof data.update === "object" &&
              ("$set" in data.update || "$unset" in data.update ||
                "$inc" in data.update || "$push" in data.update ||
                "$pull" in data.update || "$addToSet" in data.update ||
                "$pop" in data.update || "$min" in data.update ||
                "$max" in data.update || "$mul" in data.update)
              ? data.update
              : { $set: data.update };
          const options = data.options || {};
          result = await coll.updateMany(data.filter, updateManyDoc, options);
          break;
        }
        case "findOneAndUpdate": {
          const updateDoc = data.update && typeof data.update === "object" &&
              ("$set" in data.update || "$unset" in data.update ||
                "$inc" in data.update || "$push" in data.update ||
                "$pull" in data.update || "$addToSet" in data.update)
            ? data.update
            : { $set: data.update };
          const options = data.options || {};
          result = await coll.findOneAndUpdate(data.filter, updateDoc, options);
          break;
        }
        case "findOneAndDelete": {
          const options = data.options || {};
          result = await coll.findOneAndDelete(data.filter, options);
          break;
        }
        case "findOneAndReplace": {
          const options = data.options || {};
          result = await coll.findOneAndReplace(
            data.filter,
            data.replacement,
            options,
          );
          break;
        }
        case "delete":
          result = await coll.deleteOne(data.filter);
          break;
        case "deleteMany":
          result = await coll.deleteMany(data.filter);
          break;
        default:
          throw createExecuteError(`Unknown MongoDB operation: ${operation}`, {
            code: DatabaseErrorCode.EXECUTE_FAILED,
          });
      }

      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        this.queryLogger.log("execute", sql, [data], duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        this.queryLogger.log(
          "execute",
          sql,
          [data],
          duration,
          originalError,
        );
      }
      throw createExecuteError(
        `MongoDB execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql: `${operation} ${collection}`,
          params: [data],
          originalError,
        },
      );
    }
  }

  /**
   * 执行事务（MongoDB 4.0+ 支持）
   * 注意：MongoDB 事务只能在副本集（replica set）或分片集群上运行
   * 单机 MongoDB 实例不支持事务，将直接执行操作而不使用事务
   */
  async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    if (!this.client) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    // 检查是否是副本集或分片集群
    // 如果连接配置中指定了 replicaSet，直接使用事务（假设已配置为副本集）
    // 否则检查是否是副本集或分片集群（添加超时保护）
    const mongoConfig = this.config as MongoConfig | null;
    if (!mongoConfig?.mongoOptions?.replicaSet) {
      const admin = this.client.db().admin();
      // 检查是否是副本集或分片集群（添加超时保护）
      try {
        // 尝试获取副本集状态（添加超时，最多等待 2 秒）
        const statusPromise = admin.command({ replSetGetStatus: 1 });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000)
        );
        await Promise.race([statusPromise, timeoutPromise]);
      } catch {
        // 不是副本集，检查是否是分片集群（添加超时）
        try {
          const shardsPromise = admin.command({ listShards: 1 });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 2000)
          );
          await Promise.race([shardsPromise, timeoutPromise]);
        } catch {
          // 单机 MongoDB，不支持事务
          // 注意：MongoDB 事务需要副本集或分片集群
          // 单机 MongoDB 实例无法支持事务，这是 MongoDB 的设计限制
          // 如果需要事务支持，请将 MongoDB 配置为副本集（即使只有一个节点）
          throw createTransactionError(
            "MongoDB transactions are only supported on replica sets or sharded clusters. Single-node MongoDB instances do not support transactions. To enable transactions, configure MongoDB as a replica set (even with a single node) by starting MongoDB with --replSet option.",
            {
              code: DatabaseErrorCode.TRANSACTION_NOT_SUPPORTED,
            },
          );
        }
      }
    }

    // 副本集或分片集群，使用事务
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        // 创建事务适配器，使用 session 执行所有操作
        const txAdapter = new MongoDBTransactionAdapter(
          this.client!,
          this.db!,
          session,
          this.config!,
        );
        return await callback(txAdapter);
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * 获取数据库实例（用于直接操作 MongoDB）
   */
  override getDatabase(): Db | null {
    return this.db;
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(): Promise<PoolStatus> {
    if (!this.client) {
      return Promise.resolve({
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0,
      });
    }

    // MongoDB 连接池信息
    const topology = (this.client as any).topology;
    if (topology && topology.s) {
      const servers = topology.s.servers || new Map();
      let total = 0;
      let active = 0;
      let idle = 0;

      for (const server of servers.values()) {
        const pool = server.s?.pool;
        if (pool) {
          total += pool.totalConnectionCount || 0;
          active += pool.availableConnectionCount || 0;
          idle += (pool.totalConnectionCount || 0) -
            (pool.availableConnectionCount || 0);
        }
      }

      return Promise.resolve({
        total,
        active,
        idle,
        waiting: 0, // MongoDB 不直接提供等待连接数
      });
    }

    return Promise.resolve({
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    this.lastHealthCheck = new Date();

    try {
      if (!this.db) {
        return {
          healthy: false,
          error: "Database not connected",
          timestamp: new Date(),
        };
      }

      // 执行 ping 操作
      await this.db.admin().ping();
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      return {
        healthy: false,
        latency,
        error: message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 关闭连接
   * MongoDB 的 close() 可能会等待所有操作完成，导致阻塞
   * 因此立即清理状态，并在后台执行关闭，不阻塞主流程
   */
  async close(): Promise<void> {
    if (this.client) {
      const client = this.client;
      // 立即清理状态，不等待 close() 完成
      this.client = null;
      this.db = null;
      this.connected = false;

      // 在后台执行关闭，不阻塞主流程
      try {
        // 添加超时保护（1秒），如果超时就强制放弃
        const closePromise = client.close();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error("MongoDB 关闭连接超时（1秒）")),
            1000,
          );
        });

        await Promise.race([closePromise, timeoutPromise]);
      } catch (error) {
        // 关闭失败或超时，忽略错误（状态已清理）
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`MongoDB 关闭连接时出错（已忽略）: ${message}`, {
          error: message,
        });
      }
    }
  }
}

/**
 * MongoDB 事务适配器
 * 在事务中使用 session 执行所有操作
 */
class MongoDBTransactionAdapter extends MongoDBAdapter {
  private session: ClientSession;

  constructor(
    client: MongoClient,
    db: Db,
    session: ClientSession,
    config: DatabaseConfig,
  ) {
    super();
    this.client = client;
    this.db = db;
    this.session = session;
    this.config = config;
    this.connected = true;
  }

  /**
   * 执行查询（使用事务 session）
   */
  override async query(
    collection: string,
    filter?: any,
    options?: any,
  ): Promise<any[]> {
    await this.ensureConnection();
    if (!this.db) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();
    const sql = `db.${collection}.find(${JSON.stringify(filter || {})})`;

    try {
      const coll = this.db.collection(collection);
      // 使用 session 执行查询
      const cursor = coll.find(filter || {}, {
        ...options,
        session: this.session,
      });
      const results = await cursor.toArray();
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        this.queryLogger.log("query", sql, [filter, options], duration);
      }

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        this.queryLogger.log(
          "query",
          sql,
          [filter, options],
          duration,
          originalError,
        );
      }

      throw createQueryError(
        `MongoDB query error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.QUERY_FAILED,
          sql,
          params: [filter, options],
          originalError,
        },
      );
    }
  }

  /**
   * 执行操作（使用事务 session）
   */
  override async execute(
    operation: string,
    collection?: string | any[],
    data?: any,
  ): Promise<any> {
    await this.ensureConnection();
    if (!this.db) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    // MongoDB 适配器需要 collection 和 data 参数
    if (typeof collection !== "string") {
      throw createExecuteError(
        "MongoDB execute requires collection name as second parameter",
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
        },
      );
    }
    if (data === undefined) {
      throw createExecuteError(
        "MongoDB execute requires data as third parameter",
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
        },
      );
    }

    const startTime = Date.now();
    const sql = `db.${collection}.${operation}(${JSON.stringify(data)})`;

    try {
      const coll = this.db.collection(collection);
      let result: any;

      switch (operation) {
        case "insert":
          // 使用 session 执行插入
          result = await coll.insertOne(data, { session: this.session });
          break;
        case "insertMany":
          // 使用 session 执行批量插入
          result = await coll.insertMany(data, { session: this.session });
          break;
        case "update": {
          // data.update 可能已经包含 $set 等操作符，直接使用
          // 如果没有操作符，则包装为 $set
          const updateDoc = data.update && typeof data.update === "object" &&
              ("$set" in data.update || "$unset" in data.update ||
                "$inc" in data.update)
            ? data.update
            : { $set: data.update };
          // 使用 session 执行更新
          result = await coll.updateOne(data.filter, updateDoc, {
            session: this.session,
          });
          break;
        }
        case "updateMany": {
          // data.update 可能已经包含 $set 等操作符，直接使用
          // 如果没有操作符，则包装为 $set
          const updateManyDoc =
            data.update && typeof data.update === "object" &&
              ("$set" in data.update || "$unset" in data.update ||
                "$inc" in data.update)
              ? data.update
              : { $set: data.update };
          // 使用 session 执行批量更新
          result = await coll.updateMany(data.filter, updateManyDoc, {
            session: this.session,
          });
          break;
        }
        case "delete":
          // 使用 session 执行删除
          result = await coll.deleteOne(data.filter, { session: this.session });
          break;
        case "deleteMany":
          // 使用 session 执行批量删除
          result = await coll.deleteMany(data.filter, {
            session: this.session,
          });
          break;
        default:
          throw createExecuteError(`Unknown MongoDB operation: ${operation}`, {
            code: DatabaseErrorCode.EXECUTE_FAILED,
          });
      }

      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        this.queryLogger.log("execute", sql, [data], duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        this.queryLogger.log(
          "execute",
          sql,
          [data],
          duration,
          originalError,
        );
      }
      throw createExecuteError(
        `MongoDB execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql: `${operation} ${collection}`,
          params: [data],
          originalError,
        },
      );
    }
  }
}
