/**
 * PostgreSQL 数据库适配器
 *
 * @module
 */

import { createLogger } from "@dreamer/logger";
import { Pool, type PoolClient } from "pg";
import {
  createConnectionError,
  createExecuteError,
  createQueryError,
  createTransactionError,
  DatabaseErrorCode,
} from "../errors.ts";
import type {
  DatabaseAdapter,
  DatabaseConfig,
  PostgreSQLConfig,
} from "../types.ts";
import { $t } from "../i18n.ts";
import {
  BaseAdapter,
  type HealthCheckResult,
  type PoolStatus,
} from "./base.ts";

/**
 * PostgreSQL 适配器实现
 */
export class PostgreSQLAdapter extends BaseAdapter {
  protected pool: Pool | null = null;

  private logger = createLogger({
    level: "warn",
    format: "text",
    tags: ["database", "postgresql"],
  });

  /**
   * 将 ? 占位符转换为 PostgreSQL 的 $1, $2... 格式
   */
  protected toPostgresParams(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  /**
   * 连接 PostgreSQL 数据库
   * @param config PostgreSQL 数据库配置
   * @param retryCount 重试次数（内部使用）
   */
  async connect(
    config: PostgreSQLConfig | DatabaseConfig,
    retryCount: number = 0,
  ): Promise<void> {
    // 类型守卫：确保是 PostgreSQL 配置
    if (config.adapter !== "postgresql") {
      throw new Error($t("error.invalidConfigPostgres"));
    }

    const pgConfig = config as PostgreSQLConfig;
    const pool = pgConfig.pool as
      | (typeof pgConfig.pool & { maxRetries?: number; retryDelay?: number })
      | undefined;
    // 使用 ?? 而不是 ||，因为 maxRetries 可能为 0
    const maxRetries = pool?.maxRetries ?? 3;
    const retryDelay = pool?.retryDelay || 1000;

    try {
      this.validateConfig(config);
      this.config = config;

      const { host, port, database, username, password } = pgConfig.connection;

      // 获取 PostgreSQL 特定选项（连接超时等）
      const postgresqlOptions = pgConfig.postgresqlOptions || {};
      const connectionTimeoutMs = postgresqlOptions.connectionTimeout || 5000;
      // pg 库使用 connect_timeout（秒），不是 connectionTimeoutMillis
      const connectionTimeoutSeconds = Math.ceil(connectionTimeoutMs / 1000);

      // 创建连接池
      // 减少最大连接数，避免连接泄漏
      this.pool = new Pool({
        host: host || "localhost",
        port: port || 5432,
        database: database || "",
        user: username || "",
        password: password || "",
        max: pgConfig.pool?.max || 5, // 减少默认最大连接数从 10 到 5
        min: pgConfig.pool?.min || 1,
        idleTimeoutMillis: (pgConfig.pool?.idleTimeout || 10) * 1000, // 减少空闲超时从 30 秒到 10 秒
        connect_timeout: connectionTimeoutSeconds, // pg 库使用 connect_timeout（秒）
      });

      // 测试连接
      const client = await this.pool.connect();
      client.release();

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
        `PostgreSQL connection failed: ${
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
   * 执行查询
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    await this.ensureConnection();
    if (!this.pool) {
      throw createConnectionError("Database not connected", {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();
    const pgSql = this.toPostgresParams(sql);

    try {
      const result = await this.pool.query(pgSql, params);
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        await this.queryLogger.log("query", pgSql, params, duration);
      }

      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        await this.queryLogger.log(
          "query",
          pgSql,
          params,
          duration,
          originalError,
        );
      }

      throw createQueryError(
        `PostgreSQL query error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.QUERY_FAILED,
          sql: pgSql,
          params,
          originalError,
        },
      );
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
    const pgSql = this.toPostgresParams(sql);

    try {
      const result = await this.pool.query(pgSql, params);
      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        await this.queryLogger.log("execute", pgSql, params, duration);
      }

      return {
        affectedRows: result.rowCount || 0,
        rows: result.rows,
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
          pgSql,
          params,
          duration,
          originalError,
        );
      }

      throw createExecuteError(
        `PostgreSQL execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql: pgSql,
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

    const client: PoolClient = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // 创建临时适配器用于事务（支持嵌套事务）
      const txAdapter = new PostgreSQLTransactionAdapter(client, this.config);

      const result = await callback(txAdapter);
      await client.query("COMMIT");

      return result as T;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // 回滚失败，记录但不抛出（原始错误更重要）
        const msg = rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
        this.logger.warn(
          $t(
            "log.adapterPostgres.rollbackFailed",
            { error: msg },
            (this.config as PostgreSQLConfig).lang,
          ),
        );
      }
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        `PostgreSQL transaction error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.TRANSACTION_FAILED,
          originalError,
        },
      );
    } finally {
      client.release();
    }
  }

  /**
   * 创建保存点（用于嵌套事务）
   * 注意：此方法需要在事务上下文中调用
   */
  override createSavepoint(_name: string): Promise<void> {
    // 如果当前在事务中，应该使用事务适配器
    return Promise.reject(
      createTransactionError(
        "createSavepoint must be called within a transaction context. Use the transaction adapter.",
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
        },
      ),
    );
  }

  /**
   * 回滚到保存点（用于嵌套事务）
   */
  override rollbackToSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      createTransactionError(
        "rollbackToSavepoint must be called within a transaction context. Use the transaction adapter.",
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
        },
      ),
    );
  }

  /**
   * 释放保存点（用于嵌套事务）
   */
  override releaseSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      createTransactionError(
        "releaseSavepoint must be called within a transaction context. Use the transaction adapter.",
        {
          code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
        },
      ),
    );
  }

  /**
   * 获取底层数据库实例（PostgreSQL Pool）
   * 用于直接操作 PostgreSQL 连接池
   *
   * @returns PostgreSQL 连接池实例，如果未连接则返回 null
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

    return Promise.resolve({
      total: this.pool.totalCount || 0,
      active: this.pool.idleCount
        ? this.pool.totalCount - this.pool.idleCount
        : 0,
      idle: this.pool.idleCount || 0,
      waiting: this.pool.waitingCount || 0,
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
      await this.pool.query("SELECT 1");
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
        // 添加超时保护（5秒）
        const closePromise = pool.end();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error("PostgreSQL 关闭连接超时（5秒）")),
            5000,
          );
        });

        await Promise.race([closePromise, timeoutPromise]);
      } catch (error) {
        // 关闭失败或超时，忽略错误（状态已清理）
        const message = error instanceof Error ? error.message : String(error);
        const msg = $t(
          "log.adapterPostgres.closeError",
          { error: message },
          (this.config as PostgreSQLConfig).lang,
        );
        this.logger.warn(msg, { error: message });
      }
    }
  }
}

/**
 * PostgreSQL 事务适配器（支持嵌套事务）
 */
class PostgreSQLTransactionAdapter extends PostgreSQLAdapter {
  private client: PoolClient;
  savepoints: string[] = [];

  constructor(client: PoolClient, config: DatabaseConfig | null) {
    super();
    this.client = client;
    this.config = config;
    this.connected = true;
    // @ts-ignore - 临时设置 client 用于事务
    this.pool = { query: client.query.bind(client) } as any;
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
    // 事务适配器不应该关闭连接，连接由主适配器管理
    return Promise.reject(
      createTransactionError(
        "Cannot close connection in transaction adapter",
        {
          code: DatabaseErrorCode.TRANSACTION_FAILED,
        },
      ),
    );
  }

  /**
   * 执行查询（使用事务客户端）
   */
  override async query(sql: string, params: any[] = []): Promise<any[]> {
    const startTime = Date.now();
    const pgSql = this.toPostgresParams(sql);

    try {
      const result = await this.client.query(pgSql, params);
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        await this.queryLogger.log("query", pgSql, params, duration);
      }

      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));

      // 记录错误日志
      if (this.queryLogger) {
        await this.queryLogger.log(
          "query",
          pgSql,
          params,
          duration,
          originalError,
        );
      }

      throw createQueryError(
        `PostgreSQL query error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.QUERY_FAILED,
          sql: pgSql,
          params,
          originalError,
        },
      );
    }
  }

  /**
   * 执行更新/插入/删除（使用事务客户端）
   */
  override async execute(sql: string, params: any[] = []): Promise<any> {
    const startTime = Date.now();
    const pgSql = this.toPostgresParams(sql);

    try {
      const result = await this.client.query(pgSql, params);
      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        await this.queryLogger.log("execute", pgSql, params, duration);
      }

      return {
        affectedRows: result.rowCount || 0,
        rows: result.rows,
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
          pgSql,
          params,
          duration,
          originalError,
        );
      }

      throw createExecuteError(
        `PostgreSQL execute error: ${originalError.message}`,
        {
          code: DatabaseErrorCode.EXECUTE_FAILED,
          sql: pgSql,
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
      await this.client.query(`SAVEPOINT ${savepointName}`);
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
    // 找到所有匹配的保存点（保存点名称格式：sp_${name}_${timestamp}）
    // 使用字符串方法匹配保存点名称，避免使用正则表达式
    const prefix = `sp_${name}_`;
    const matchingSavepoints = this.savepoints.filter((sp) => {
      if (!sp.startsWith(prefix)) {
        return false;
      }
      // 检查时间戳部分是否全是数字（不使用正则表达式）
      const timestampPart = sp.slice(prefix.length);
      return timestampPart.length > 0 &&
        timestampPart.split("").every((char) => char >= "0" && char <= "9");
    });
    if (matchingSavepoints.length === 0) {
      throw createTransactionError(`Savepoint "${name}" not found`, {
        code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
      });
    }
    // 取最后一个匹配的保存点（最新的）
    const savepointName = matchingSavepoints[matchingSavepoints.length - 1];

    try {
      await this.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      // 移除该保存点之后的所有保存点
      const index = this.savepoints.indexOf(savepointName);
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
    // 找到所有匹配的保存点（保存点名称格式：sp_${name}_${timestamp}）
    // 使用字符串方法匹配保存点名称，避免使用正则表达式
    const prefix = `sp_${name}_`;
    const matchingSavepoints = this.savepoints.filter((sp) => {
      if (!sp.startsWith(prefix)) {
        return false;
      }
      // 检查时间戳部分是否全是数字（不使用正则表达式）
      const timestampPart = sp.slice(prefix.length);
      return timestampPart.length > 0 &&
        timestampPart.split("").every((char) => char >= "0" && char <= "9");
    });
    if (matchingSavepoints.length === 0) {
      throw createTransactionError(`Savepoint "${name}" not found`, {
        code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
      });
    }
    // 取最后一个匹配的保存点（最新的）
    const savepointName = matchingSavepoints[matchingSavepoints.length - 1];

    try {
      await this.client.query(`RELEASE SAVEPOINT ${savepointName}`);
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
      const nestedAdapter = new PostgreSQLTransactionAdapter(
        this.client,
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
}
