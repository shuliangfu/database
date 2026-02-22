/**
 * SQLite 数据库适配器
 *
 * @module
 */

import { createLogger } from "@dreamer/logger";
import { IS_BUN, IS_DENO } from "@dreamer/runtime-adapter";
import {
  createConfigError,
  createConnectionError,
  createExecuteError,
  createQueryError,
  createTransactionError,
  DatabaseErrorCode,
} from "../errors.ts";
import { $tr, setDatabaseLocale } from "../i18n.ts";
import type {
  DatabaseAdapter,
  DatabaseConfig,
  SQLiteConfig,
} from "../types.ts";
import {
  BaseAdapter,
  type HealthCheckResult,
  type PoolStatus,
} from "./base.ts";

/**
 * SQLite 数据库接口（统一抽象）
 */
interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
}

/**
 * SQLite 语句接口（统一抽象）
 */
interface SQLiteStatement {
  all(...params: any[]): any[];
  run(...params: any[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  get(...params: any[]): any;
}

/**
 * SQLite 适配器实现
 * - Deno: 使用 node:sqlite (Deno 2.2+ 内置)
 * - Bun: 使用 bun:sqlite 原生 API，不可用时直接抛错（不拉取 better-sqlite3，避免 prebuild-install 弃用警告）
 * - Node 等其它运行时: 抛错，请使用 Deno 2.2+ 或 Bun 以使用 SQLite
 */
export class SQLiteAdapter extends BaseAdapter {
  protected db: SQLiteDatabase | null = null;

  private logger = createLogger({
    level: "warn",
    format: "text",
    tags: ["database", "sqlite"],
  });

  /**
   * 创建 Bun 原生 SQLite API 的适配器包装
   * Bun 原生 API 使用 query() 方法而不是 prepare()，需要适配
   */
  private createBunNativeAdapter(bunDb: any): SQLiteDatabase {
    return {
      prepare(sql: string): SQLiteStatement {
        // Bun 使用 query() 方法创建查询语句
        const query = bunDb.query(sql);
        return {
          all(...params: any[]): any[] {
            // Bun 的 query.all() 接受参数作为数组或展开参数
            if (params.length === 0) {
              return query.all();
            } else if (
              params.length === 1 && typeof params[0] === "object" &&
              !Array.isArray(params[0])
            ) {
              // 如果是对象参数（命名参数），直接传递
              return query.all(params[0]);
            } else {
              // 如果是位置参数，需要转换为对象或使用数组
              // Bun 支持位置参数，但需要检查 API
              try {
                return query.all(...params);
              } catch {
                // 如果展开参数失败，尝试作为数组传递
                return query.all(params);
              }
            }
          },
          run(...params: any[]): {
            changes: number | bigint;
            lastInsertRowid: number | bigint;
          } {
            // Bun 的 query.run() 返回 { changes, lastInsertRowid }
            let result: any;
            if (params.length === 0) {
              result = query.run();
            } else if (
              params.length === 1 && typeof params[0] === "object" &&
              !Array.isArray(params[0])
            ) {
              // 如果是对象参数（命名参数），直接传递
              result = query.run(params[0]);
            } else {
              // 如果是位置参数
              try {
                result = query.run(...params);
              } catch {
                // 如果展开参数失败，尝试作为数组传递
                result = query.run(params);
              }
            }
            // Bun 原生 API 返回的格式
            return {
              changes: result?.changes || 0,
              lastInsertRowid: result?.lastInsertRowid || 0,
            };
          },
          get(...params: any[]): any {
            // Bun 的 query.get() 接受参数
            if (params.length === 0) {
              return query.get();
            } else if (
              params.length === 1 && typeof params[0] === "object" &&
              !Array.isArray(params[0])
            ) {
              return query.get(params[0]);
            } else {
              try {
                return query.get(...params);
              } catch {
                return query.get(params);
              }
            }
          },
        };
      },
      exec(sql: string): void {
        // Bun 使用 exec() 方法执行 SQL
        bunDb.exec(sql);
      },
      close(): void {
        // Bun 使用 close() 方法关闭数据库
        bunDb.close();
      },
    };
  }

  /**
   * 连接 SQLite 数据库
   * @param config SQLite 数据库配置
   */
  async connect(config: SQLiteConfig | DatabaseConfig): Promise<void> {
    // 类型守卫：确保是 SQLite 配置
    if (config.adapter !== "sqlite") {
      throw new Error($tr("error.invalidConfigSqlite"));
    }

    const sqliteConfig = config as SQLiteConfig;
    try {
      this.validateConfig(config);
      this.config = config;
      if (sqliteConfig.lang) {
        setDatabaseLocale(sqliteConfig.lang);
      }

      const { filename } = sqliteConfig.connection;
      if (!filename) {
        throw createConfigError($tr("error.sqliteFilenameRequired"), {
          code: DatabaseErrorCode.CONFIG_MISSING,
        });
      }

      // 根据运行时环境选择不同的 SQLite 实现
      if (IS_DENO) {
        // Deno: 使用内置的 node:sqlite 模块
        const { DatabaseSync } = await import("node:sqlite");
        // 注意：node:sqlite 的 DatabaseSync 可能不支持 readonly 选项
        // 如果配置了 readonly 且不是内存数据库，尝试以只读模式打开
        // 但 node:sqlite 可能不支持此选项，所以这里先忽略
        // TODO: 检查 node:sqlite 是否支持 readonly 选项
        this.db = new DatabaseSync(filename);
        this.connected = true;
      } else if (IS_BUN) {
        // Bun: 优先使用 bun:sqlite，低版本或不可用时回退到 better-sqlite3
        try {
          // 尝试使用 Bun 原生 SQLite API (bun:sqlite)
          // 使用动态导入以避免在 Deno 环境中的 linter 错误
          // deno-lint-ignore no-await-in-loop
          const sqliteModule = await import("bun:sqlite" as string);
          const BunDatabase = sqliteModule.Database;
          const nativeDb = new BunDatabase(filename);
          // 创建适配器包装 Bun 原生 API
          this.db = this.createBunNativeAdapter(nativeDb);
          this.connected = true;
        } catch (nativeError) {
          // Bun 原生 SQLite 不可用时直接抛错，不再拉取 better-sqlite3（避免 prebuild-install 弃用警告）
          const msg = nativeError instanceof Error
            ? nativeError.message
            : String(nativeError);
          throw createConnectionError(
            $tr("error.sqliteConnectionFailed", {
              nativeError: msg,
              betterError: $tr("error.sqliteUnsupportedRuntime"),
            }),
            {
              code: DatabaseErrorCode.CONNECTION_FAILED,
              originalError: nativeError instanceof Error
                ? nativeError
                : new Error(String(nativeError)),
            },
          );
        }
      } else {
        // Node 或其它无内置 SQLite 的运行时：不拉取 better-sqlite3，避免 prebuild-install 警告；需 SQLite 时请使用 Deno 2.2+ 或 Bun
        throw createConfigError(
          $tr("error.sqliteUnsupportedRuntime"),
          { code: DatabaseErrorCode.CONFIG_INVALID },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw createConnectionError(
        $tr("error.sqliteConnectionError", { message }),
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
   * 检查连接
   */
  private ensureConnection(): void {
    if (!this.connected || !this.db) {
      throw createConnectionError($tr("error.databaseNotConnected"), {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }
  }

  /**
   * 执行查询（返回结果集）
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    this.ensureConnection();
    if (!this.db) {
      throw createConnectionError($tr("error.databaseNotConnected"), {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();

    try {
      // 使用 Promise 包装同步操作以保持接口一致性
      await Promise.resolve();
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      const duration = Date.now() - startTime;

      // 记录查询日志
      if (this.queryLogger) {
        // 异步日志记录（不阻塞）
        Promise.resolve(this.queryLogger.log("query", sql, params, duration))
          .catch(() => {});
      }

      return rows as any[];
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      if (this.queryLogger) {
        Promise.resolve(
          this.queryLogger.log("query", sql, params, duration, error as Error),
        ).catch(() => {});
      }

      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createQueryError(
        $tr("error.sqliteQueryError", { message: originalError.message }),
        {
          code: DatabaseErrorCode.QUERY_FAILED,
          sql,
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
    this.ensureConnection();
    if (!this.db) {
      throw createConnectionError($tr("error.databaseNotConnected"), {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    const startTime = Date.now();

    try {
      // 使用 Promise 包装同步操作以保持接口一致性
      await Promise.resolve();
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      const duration = Date.now() - startTime;

      // 记录执行日志
      if (this.queryLogger) {
        Promise.resolve(this.queryLogger.log("execute", sql, params, duration))
          .catch(() => {});
      }

      // 统一处理 lastInsertRowid 和 changes（可能是 number 或 bigint）
      const lastInsertRowid = typeof result.lastInsertRowid === "bigint"
        ? Number(result.lastInsertRowid)
        : result.lastInsertRowid;
      const affectedRows = typeof result.changes === "bigint"
        ? Number(result.changes)
        : result.changes;

      return {
        affectedRows: affectedRows || 0,
        lastInsertRowid: lastInsertRowid || null,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      if (this.queryLogger) {
        Promise.resolve(
          this.queryLogger.log(
            "execute",
            sql,
            params,
            duration,
            error as Error,
          ),
        ).catch(() => {});
      }

      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createExecuteError(
        $tr("error.sqliteExecuteError", { message: originalError.message }),
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
   * 注意：SQLite 的事务是同步的，但我们的回调是异步的
   * 我们需要手动管理事务的开始、提交和回滚
   */
  async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    this.ensureConnection();
    if (!this.db) {
      throw createConnectionError($tr("error.databaseNotConnected"), {
        code: DatabaseErrorCode.CONNECTION_NOT_INITIALIZED,
      });
    }

    // 创建临时适配器用于事务（支持嵌套事务）
    const txAdapter = new SQLiteTransactionAdapter(this.db, this.config);

    try {
      // 手动开始事务
      this.db.exec("BEGIN TRANSACTION");

      // 执行回调
      const result = await callback(txAdapter);

      // 提交事务
      this.db.exec("COMMIT");

      return result as T;
    } catch (error) {
      // 回滚事务
      try {
        this.db.exec("ROLLBACK");
      } catch (_rollbackError) {
        // 忽略回滚错误
      }

      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      throw createTransactionError(
        $tr("error.sqliteTransactionError", {
          message: originalError.message,
        }),
        {
          code: DatabaseErrorCode.TRANSACTION_FAILED,
          originalError,
        },
      );
    }
  }

  /**
   * 获取底层数据库实例（SQLite Database）
   * 用于直接操作 SQLite 数据库
   *
   * @returns SQLite 数据库实例，如果未连接则返回 null
   */
  override getDatabase(): SQLiteDatabase | null {
    return this.db;
  }

  /**
   * 获取连接池状态
   * SQLite 是文件数据库，不需要连接池，返回模拟状态
   */
  getPoolStatus(): Promise<PoolStatus> {
    return Promise.resolve({
      total: 1,
      active: this.connected ? 1 : 0,
      idle: this.connected ? 0 : 1,
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
          error: $tr("error.databaseNotConnected"),
          timestamp: new Date(),
        };
      }

      // 执行简单查询
      await this.query("SELECT 1");
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
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        // SQLite 的 close 是同步的，用 Promise 包装
        await new Promise<void>((resolve, reject) => {
          try {
            this.db!.close();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const msg = $tr("log.adapterSqlite.closeError", { error: message });
        this.logger.warn(msg, { error: message });
      } finally {
        // 无论成功与否，都清理状态
        this.db = null;
        this.connected = false;
      }
    }
  }

  /**
   * 创建保存点（用于嵌套事务）
   * 注意：此方法需要在事务上下文中调用
   */
  override createSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      createTransactionError(
        $tr("error.savepointMustBeInTransaction", {
          method: "createSavepoint",
        }),
        { code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED },
      ),
    );
  }

  /**
   * 回滚到保存点（用于嵌套事务）
   */
  override rollbackToSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      createTransactionError(
        $tr("error.savepointMustBeInTransaction", {
          method: "rollbackToSavepoint",
        }),
        { code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED },
      ),
    );
  }

  /**
   * 释放保存点（用于嵌套事务）
   */
  override releaseSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      createTransactionError(
        $tr("error.savepointMustBeInTransaction", {
          method: "releaseSavepoint",
        }),
        { code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED },
      ),
    );
  }
}

/**
 * SQLite 事务适配器（支持嵌套事务）
 */
class SQLiteTransactionAdapter extends SQLiteAdapter {
  private transactionDb: SQLiteDatabase;
  savepoints: string[] = [];

  constructor(db: SQLiteDatabase, config: DatabaseConfig | null) {
    super();
    this.transactionDb = db;
    this.db = db;
    this.config = config;
    this.connected = true;
  }

  /**
   * 创建保存点（用于嵌套事务）
   */
  override createSavepoint(name: string): Promise<void> {
    const savepointName = `sp_${name}_${Date.now()}`;
    this.savepoints.push(savepointName);
    try {
      this.transactionDb.exec(`SAVEPOINT ${savepointName}`);
      return Promise.resolve();
    } catch (error) {
      this.savepoints.pop();
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      return Promise.reject(
        createTransactionError(
          $tr("error.sqliteSavepointCreateFailed", {
            message: originalError.message,
          }),
          {
            code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
            sql: `SAVEPOINT ${savepointName}`,
            originalError,
          },
        ),
      );
    }
  }

  /**
   * 回滚到保存点（用于嵌套事务）
   */
  override rollbackToSavepoint(name: string): Promise<void> {
    const savepointName = this.savepoints.find((sp) => sp.includes(name));
    if (!savepointName) {
      return Promise.reject(
        createTransactionError(
          $tr("error.sqliteSavepointNotFound", { name }),
          { code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED },
        ),
      );
    }

    try {
      this.transactionDb.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      // 移除该保存点之后的所有保存点
      const index = this.savepoints.indexOf(savepointName);
      this.savepoints = this.savepoints.slice(0, index + 1);
      return Promise.resolve();
    } catch (error) {
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      return Promise.reject(
        createTransactionError(
          $tr("error.sqliteSavepointRollbackFailed", {
            message: originalError.message,
          }),
          {
            code: DatabaseErrorCode.TRANSACTION_ROLLBACK_FAILED,
            sql: `ROLLBACK TO SAVEPOINT ${savepointName}`,
            originalError,
          },
        ),
      );
    }
  }

  /**
   * 释放保存点（用于嵌套事务）
   */
  override releaseSavepoint(name: string): Promise<void> {
    const savepointName = this.savepoints.find((sp) => sp.includes(name));
    if (!savepointName) {
      return Promise.reject(
        createTransactionError(
          $tr("error.sqliteSavepointNotFound", { name }),
          { code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED },
        ),
      );
    }

    try {
      this.transactionDb.exec(`RELEASE SAVEPOINT ${savepointName}`);
      // 移除该保存点
      const index = this.savepoints.indexOf(savepointName);
      this.savepoints.splice(index, 1);
      return Promise.resolve();
    } catch (error) {
      const originalError = error instanceof Error
        ? error
        : new Error(String(error));
      return Promise.reject(
        createTransactionError(
          $tr("error.sqliteSavepointReleaseFailed", {
            message: originalError.message,
          }),
          {
            code: DatabaseErrorCode.TRANSACTION_SAVEPOINT_FAILED,
            sql: `RELEASE SAVEPOINT ${savepointName}`,
            originalError,
          },
        ),
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
      const nestedAdapter = new SQLiteTransactionAdapter(
        this.transactionDb,
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
      createTransactionError($tr("error.cannotCloseInTransaction"), {
        code: DatabaseErrorCode.TRANSACTION_FAILED,
      }),
    );
  }
}
