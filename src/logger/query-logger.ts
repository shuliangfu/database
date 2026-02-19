/**
 * 查询日志记录器
 * 使用 @dreamer/logger 库进行日志记录
 */

import { createLogger, type Logger } from "@dreamer/logger";
import type { Locale } from "../i18n.ts";
import { $tr } from "../i18n.ts";

/**
 * 查询日志条目
 */
export interface QueryLogEntry {
  type: "query" | "execute";
  sql: string;
  params?: any[];
  duration: number;
  timestamp: Date;
  error?: Error;
  connection?: string;
}

/**
 * 查询日志记录器配置
 */
export interface QueryLoggerConfig {
  enabled?: boolean;
  logLevel?: "all" | "error" | "slow"; // all: 所有查询, error: 仅错误, slow: 仅慢查询
  slowQueryThreshold?: number; // 慢查询阈值（毫秒）
  /** 自定义 logger 实例（可选，传入时使用该 logger，不传则使用自带的 createLogger） */
  logger?: Logger;
  /** 是否启用调试模式（默认 false）。为 true 时，正常查询日志使用 info 级别输出，便于在 info 级别下查看 */
  debug?: boolean;
  /**
   * 内存中保留的日志条数上限（防止内存泄漏，默认 1000）
   * 超过时自动移除最旧的条目，设为 0 表示不限制（不推荐长期运行场景）
   */
  maxLogs?: number;
  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   */
  lang?: Locale;
}

/**
 * 查询日志记录器
 */
export class QueryLogger {
  private logs: QueryLogEntry[] = [];
  private config: QueryLoggerConfig;
  private logger: Logger;

  constructor(config: QueryLoggerConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      logLevel: config.logLevel ?? "all",
      slowQueryThreshold: config.slowQueryThreshold ?? 1000,
      maxLogs: config.maxLogs ?? 1000,
      debug: config.debug ?? false,
      lang: config.lang,
    };

    // 传入 logger 时使用该 logger，不传则使用自带的 createLogger
    this.logger = config.logger ?? createLogger({
      level: "info",
      format: "text",
      tags: ["database", "query"],
    });
  }

  /**
   * 记录查询日志
   */
  log(
    type: "query" | "execute",
    sql: string,
    params: any[],
    duration: number,
    error?: Error,
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // 根据日志级别过滤
    if (this.config.logLevel === "error" && !error) {
      return;
    }

    if (
      this.config.logLevel === "slow" &&
      (!error && duration < (this.config.slowQueryThreshold || 1000))
    ) {
      return;
    }

    const entry: QueryLogEntry = {
      type,
      sql,
      params,
      duration,
      timestamp: new Date(),
      error,
    };

    // 保存到内存（用于 getLogs），超过 maxLogs 时移除最旧条目，防止内存泄漏
    this.logs.push(entry);
    const maxLogs = this.config.maxLogs ?? 1000;
    if (maxLogs > 0 && this.logs.length > maxLogs) {
      this.logs = this.logs.slice(-maxLogs);
    }

    // 使用 logger 库记录日志
    const logData = {
      type,
      sql,
      params: params.length > 0 ? params : undefined,
      duration: `${duration}ms`,
    };

    if (error) {
      // 记录错误日志
      const errorKey = type === "query"
        ? "log.database.queryError"
        : "log.database.executeError";
      const msg = $tr(errorKey, { sql }, this.config.lang);
      this.logger.error(msg, logData, error);
    } else if (duration >= (this.config.slowQueryThreshold || 1000)) {
      // 慢查询警告
      const msg = $tr("log.database.slowQuery", {
        sql,
        duration: String(duration),
      }, this.config.lang);
      this.logger.warn(msg, logData);
    } else {
      // 正常查询信息：debug 为 true 时用 info 级别（便于在 info 级别下查看），否则用 debug
      const infoKey = type === "query"
        ? "log.database.queryInfo"
        : "log.database.executeInfo";
      const msg = $tr(infoKey, { sql }, this.config.lang);
      if (this.config.debug) {
        this.logger.info(msg, logData);
      } else {
        this.logger.debug(msg, logData);
      }
    }
  }

  /**
   * 获取所有日志
   */
  getLogs(): QueryLogEntry[] {
    return [...this.logs];
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 获取 logger 实例（用于自定义配置）
   */
  getLogger(): Logger {
    return this.logger;
  }
}
