/**
 * MySQL/MariaDB 数据库适配器
 *
 * @module
 */

import { createLogger } from "@dreamer/logger";
import { createPool, type Pool, type PoolConnection } from "mysql2/promise";
import {
  createConnectionError,
  createExecuteError,
  createQueryError,
  createTransactionError,
  DatabaseErrorCode,
} from "../errors.ts";
import type { DatabaseAdapter, DatabaseConfig, MySQLConfig } from "../types.ts";
import {
  BaseAdapter,
  type HealthCheckResult,
  type PoolStatus,
} from "./base.ts";

/**
 * MySQL 适配器实现（兼容 MariaDB）
 */
export class MySQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;

  /** 获取翻译文本，无 t 或翻译缺失时返回 fallback */
  private tr(
    key: string,
    fallback: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    const t = (this.config as MySQLConfig).t;
    const r = t?.(key, params);
    return (r != null && r !== key) ? r : fallback;
  }

  private logger = createLogger({
    level: "warn",
    format: "text",
    tags: ["database", "mysql"],
  });

  /**
   * 连接 MySQL/MariaDB 数据库
   * @param config MySQL/MariaDB 数据库配置
   * @param retryCount 重试次数（内部使用）
   */
  async connect(
    config: MySQLConfig | DatabaseConfig,
    retryCount: number = 0,
  ): Promise<void> {
    // 类型守卫：确保是 MySQL 配置
    if (config.type !== "mysql") {
      throw new Error("Invalid config type for MySQL adapter");
    }

    const mysqlConfig = config as MySQLConfig;
    const pool = mysqlConfig.pool as
      | (typeof mysqlConfig.pool & { maxRetries?: number; retryDelay?: number })
      | undefined;
    const maxRetries = pool?.maxRetries || 3;
    const retryDelay = pool?.retryDelay || 1000;

    try {
      this.validateConfig(config);
      this.config = config;

      const { host, port, database, username, password } =
        mysqlConfig.connection;

      // 创建连接池
      this.pool = createPool({
        host: host || "localhost",
        port: port || 3306,
        database: database || "",
        user: username || "",
        password: password || "",
        connectionLimit: mysqlConfig.pool?.max || 10,
        waitForConnections: true,
        queueLimit: 0,
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      connection.release();

      this.connected = true;
    } catch (error) {
      // 连接失败时，清理已创建的连接池
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (_closeError) {
          // 忽略关闭错误
        }
        this.pool = null;
      }
      this.connected = false;

      // 自动重连机制
      if (retryCount < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (retryCount + 1))
        );
        return await this.connect(config, retryCount + 1);
      }
      throw createConnectionError(
        `MySQL connection failed: ${
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
  private async ensureConnection(): Promise<void> {
    if (!this.connected || !this.pool) {
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
   * 执行查询（返回结果集）
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    await this.ensureConnection();
    if (!this.pool) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();

    try {
      const [rows] = await (this.pool as any).query(sql, params) as any[];
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        await this.queryLogger.log("query", sql, params, duration);
      }

      return rows as any[];
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      if (this.queryLogger) {
        this.queryLogger.log(
          "query",
          sql,
          params,
          duration,
          error as Error,
        );
      }

      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createQueryError(`MySQL query error: ${originalError.message}`, {
        code: DatabaseErrorCode.QUERY_FAILED,
        sql,
        params,
        originalError,
      });
    }
  }

  /**
   * 执行更新/插入/删除
   */
  async execute(sql: string, params: any[] = []): Promise<any> {
    await this.ensureConnection();
    if (!this.pool) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();

    try {
      const [result] = await (this.pool as any).query(sql, params) as any;
      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        await this.queryLogger.log("execute", sql, params, duration);
      }

      return {
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId,
        rows: [],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        await this.queryLogger.log(
          "execute",
          sql,
          params,
          duration,
          originalError,
        );
      }

      throw createExecuteError(
        `MySQL execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql,
          params,
          originalError,
        },
      );
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const connection: PoolConnection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // 创建临时适配器用于事务（支持嵌套事务）
      const txAdapter = new MySQLTransactionAdapter(connection, this.config);

      const result = await callback(txAdapter);
      await connection.commit();

      return result as T;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        const msg = rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
        this.logger.warn(`MySQL transaction rollback failed: ${msg}`);
      }
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        `MySQL transaction error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.TRANSACTION_FAILED,
          originalError,
        },
      );
    } finally {
      connection.release();
    }
  }

  /**
   * 获取底层数据库实例（MySQL Pool）
   * 用于直接操作 MySQL 连接池
   *
   * @returns MySQL 连接池实例，如果未连接则返回 null
   */
  override getDatabase(): Pool | null {
    return this.pool;
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(): Promise<PoolStatus> {
    if (!this.pool) {
      return Promise.resolve({
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0,
      });
    }

    // mysql2 连接池信息
    const pool = this.pool as any;
    return Promise.resolve({
      total: pool._allConnections?.length || 0,
      active: pool._acquiredConnections?.length || 0,
      idle: (pool._allConnections?.length || 0) -
        (pool._acquiredConnections?.length || 0),
      waiting: pool._connectionQueue?.length || 0,
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    this.lastHealthCheck = new Date();

    try {
      if (!this.pool) {
        return {
          healthy: false,
          error: "Database not connected",
          timestamp: new Date(),
        };
      }

      // 执行简单查询
      await (this.pool as any).query("SELECT 1");
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
   * 添加超时保护，避免关闭操作阻塞
   */
  async close(): Promise<void> {
    if (this.pool) {
      const pool = this.pool;
      // 先清理状态，避免重复关闭
      this.pool = null;
      this.connected = false;

      try {
        // 添加超时保护（3秒）
        const closePromise = pool.end();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error("MySQL 关闭连接超时（3秒）")),
            3000,
          );
        });

        await Promise.race([closePromise, timeoutPromise]);
      } catch (error) {
        // 关闭失败或超时，忽略错误（状态已清理）
        const message = error instanceof Error ? error.message : String(error);
        const msg = this.tr(
          "log.adapterMysql.closeError",
          `MySQL 关闭连接时出错（已忽略）: ${message}`,
          { error: message },
        );
        this.logger.warn(msg, { error: message });
      }
    }
  }
}

/**
 * MySQL 事务适配器（支持嵌套事务）
 */
class MySQLTransactionAdapter extends MySQLAdapter {
  private connection: PoolConnection;
  savepoints: string[] = [];

  constructor(connection: PoolConnection, config: DatabaseConfig | null) {
    super();
    this.connection = connection;
    this.config = config;
    this.connected = true;
    // @ts-ignore - 临时设置 pool 用于事务
    this.pool = {
      query: connection.query.bind(connection),
      execute: connection.execute.bind(connection),
    } as any;
  }

  /**
   * 执行查询（使用事务连接）
   */
  override async query(sql: string, params: any[] = []): Promise<any[]> {
    const startTime = Date.now();

    try {
      const [rows] = await this.connection.query(sql, params) as any[];
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        await this.queryLogger.log("query", sql, params, duration);
      }

      return rows as any[];
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        await this.queryLogger.log(
          "query",
          sql,
          params,
          duration,
          originalError,
        );
      }

      throw createQueryError(`MySQL query error: ${originalError.message}`, {
        code: DatabaseErrorCode.QUERY_FAILED,
        sql,
        params,
        originalError,
      });
    }
  }

  /**
   * 执行更新/插入/删除（使用事务连接）
   */
  override async execute(sql: string, params: any[] = []): Promise<any> {
    const startTime = Date.now();

    try {
      const [result] = await this.connection.execute(sql, params) as any;
      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        await this.queryLogger.log("execute", sql, params, duration);
      }

      return {
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId,
        rows: [],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        await this.queryLogger.log(
          "execute",
          sql,
          params,
          duration,
          originalError,
        );
      }

      throw createExecuteError(
        `MySQL execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql,
          params,
          originalError,
        },
      );
    }
  }

  /**
   * 创建保存点（用于嵌套事务）
   */
  override async createSavepoint(name: string): Promise<void> {
    const savepointName = `sp_${name}_${Date.now()}`;
    this.savepoints.push(savepointName);
    try {
      await this.connection.query(`SAVEPOINT ${savepointName}`);
    } catch (error) {
      this.savepoints.pop();
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        `Failed to create savepoint: ${originalError.message}`,
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
          sql: `SAVEPOINT ${savepointName}`,
          originalError,
        },
      );
    }
  }

  /**
   * 回滚到保存点（用于嵌套事务）
   * 如果有多个同名保存点，回滚到最后一个（最新的）
   */
  override async rollbackToSavepoint(name: string): Promise<void> {
    // 找到所有匹配的保存点，取最后一个（最新的）
    // 保存点名称格式是 sp_${name}_${timestamp}，所以需要精确匹配 name 部分
    // 例如：如果 name 是 "sp2"，保存点名称是 "sp_sp2_1234567890"
    const matchingSavepoints = this.savepoints.filter((sp) => {
      // 保存点名称格式：sp_${name}_${timestamp}
      // 例如：sp_sp1_1234567890，需要匹配 name 部分为 "sp1"
      // 使用正则匹配：sp_ 开头，然后是 name，然后是 _ 和数字结尾
      const match = sp.match(/^sp_(.+?)_\d+$/);
      return match && match[1] === name;
    });
    if (matchingSavepoints.length === 0) {
      throw createTransactionError(
        `Savepoint '${name}' not found. Available savepoints: ${
          this.savepoints.join(", ")
        }`,
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
        },
      );
    }
    // 取最后一个匹配的保存点（最新的）
    const savepointName = matchingSavepoints[matchingSavepoints.length - 1];

    try {
      await this.connection.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      // 移除该保存点之后的所有保存点
      const index = this.savepoints.indexOf(savepointName);
      if (index === -1) {
        throw createTransactionError(
          `Savepoint '${savepointName}' not found in savepoints list`,
          {
            code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
          },
        );
      }
      this.savepoints = this.savepoints.slice(0, index + 1);
    } catch (error) {
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        `Failed to rollback to savepoint: ${originalError.message}`,
        {
          code: DatabaseErrorCode.TRANSACTION_ROLLBACK_FAILED,
          sql: `ROLLBACK TO SAVEPOINT ${savepointName}`,
          originalError,
        },
      );
    }
  }

  /**
   * 释放保存点（用于嵌套事务）
   */
  override async releaseSavepoint(name: string): Promise<void> {
    const savepointName = this.savepoints.find((sp) => sp.includes(name));
    if (!savepointName) {
      throw createTransactionError(`Savepoint "${name}" not found`, {
        code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
      });
    }

    try {
      await this.connection.query(`RELEASE SAVEPOINT ${savepointName}`);
      // 移除该保存点
      const index = this.savepoints.indexOf(savepointName);
      this.savepoints.splice(index, 1);
    } catch (error) {
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        `Failed to release savepoint: ${originalError.message}`,
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
          sql: `RELEASE SAVEPOINT ${savepointName}`,
          originalError,
        },
      );
    }
  }

  /**
   * 执行嵌套事务
   */
  override async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    // 创建保存点以实现嵌套事务
    const savepointName = `nested_${Date.now()}`;
    await this.createSavepoint(savepointName);

    try {
      // 创建嵌套事务适配器
      const nestedAdapter = new MySQLTransactionAdapter(
        this.connection,
        this.config,
      );
      // 复制当前保存点列表
      nestedAdapter.savepoints = [...this.savepoints];

      const result = await callback(nestedAdapter);
      // 释放保存点（提交嵌套事务）
      await this.releaseSavepoint(savepointName);

      return result;
    } catch (error) {
      // 回滚到保存点
      await this.rollbackToSavepoint(savepointName);
      throw error;
    }
  }

  /**
   * 获取连接池状态（事务中不支持）
   */
  override getPoolStatus(): Promise<PoolStatus> {
    return Promise.resolve({
      total: 1,
      active: 1,
      idle: 0,
      waiting: 0,
    });
  }

  /**
   * 健康检查（事务中不支持）
   */
  override healthCheck(): Promise<HealthCheckResult> {
    return Promise.resolve({
      healthy: true,
      latency: 0,
      timestamp: new Date(),
    });
  }

  /**
   * 关闭连接（事务中不支持）
   */
  override close(): Promise<void> {
    return Promise.reject(
      createTransactionError(
        "Cannot close connection in transaction adapter",
        {
          code: DatabaseErrorCode.TRANSACTION_FAILED,
        },
      ),
    );
  }
}
