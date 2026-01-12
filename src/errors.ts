/**
 * 数据库错误类
 * 提供统一的错误分类和处理
 */

/**
 * 错误代码枚举
 */
export enum DatabaseErrorCode {
  // 连接错误 (1xxx)
  CONNECTION_FAILED = "1001",
  CONNECTION_TIMEOUT = "1002",
  CONNECTION_CLOSED = "1003",
  CONNECTION_NOT_INITIALIZED = "1004",
  CONNECTION_POOL_EXHAUSTED = "1005",

  // 查询错误 (2xxx)
  QUERY_FAILED = "2001",
  QUERY_TIMEOUT = "2002",
  QUERY_SYNTAX_ERROR = "2003",
  QUERY_PARAMETER_ERROR = "2004",

  // 执行错误 (3xxx)
  EXECUTE_FAILED = "3001",
  EXECUTE_TIMEOUT = "3002",
  EXECUTE_CONSTRAINT_VIOLATION = "3003",

  // 事务错误 (4xxx)
  TRANSACTION_FAILED = "4001",
  TRANSACTION_ROLLBACK_FAILED = "4002",
  TRANSACTION_COMMIT_FAILED = "4003",
  TRANSACTION_SAVEPOINT_FAILED = "4004",
  TRANSACTION_ALREADY_STARTED = "4005",
  TRANSACTION_NOT_SUPPORTED = "4006",

  // 配置错误 (5xxx)
  CONFIG_INVALID = "5001",
  CONFIG_MISSING = "5002",

  // 未知错误 (9xxx)
  UNKNOWN_ERROR = "9001",
}

/**
 * 数据库错误类
 * 统一的错误处理，包含错误代码、SQL、参数、连接信息等
 */
export class DatabaseError extends Error {
  /**
   * 错误代码
   */
  code: DatabaseErrorCode | string;

  /**
   * SQL 语句（如果有）
   */
  sql?: string;

  /**
   * 查询参数（如果有）
   */
  params?: any[];

  /**
   * 连接名称（如果有）
   */
  connection?: string;

  /**
   * 原始错误对象
   */
  originalError?: Error;

  /**
   * 错误类型（连接错误、查询错误、执行错误、事务错误、配置错误）
   */
  errorType:
    | "connection"
    | "query"
    | "execute"
    | "transaction"
    | "config"
    | "unknown";

  constructor(
    message: string,
    options: {
      code: DatabaseErrorCode | string;
      sql?: string;
      params?: any[];
      connection?: string;
      originalError?: Error;
    },
  ) {
    super(message);
    this.name = "DatabaseError";
    this.code = options.code;
    this.sql = options.sql;
    this.params = options.params;
    this.connection = options.connection;
    this.originalError = options.originalError;

    // 根据错误代码确定错误类型
    const codeStr = String(options.code);
    if (codeStr.startsWith("1")) {
      this.errorType = "connection";
    } else if (codeStr.startsWith("2")) {
      this.errorType = "query";
    } else if (codeStr.startsWith("3")) {
      this.errorType = "execute";
    } else if (codeStr.startsWith("4")) {
      this.errorType = "transaction";
    } else if (codeStr.startsWith("5")) {
      this.errorType = "config";
    } else {
      this.errorType = "unknown";
    }

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }

  /**
   * 获取错误的详细信息（用于日志记录）
   */
  getDetails(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      errorType: this.errorType,
      sql: this.sql,
      params: this.params,
      connection: this.connection,
      originalError: this.originalError
        ? {
          name: this.originalError.name,
          message: this.originalError.message,
          stack: this.originalError.stack,
        }
        : undefined,
    };
  }

  /**
   * 转换为 JSON（用于序列化）
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errorType: this.errorType,
      sql: this.sql,
      params: this.params,
      connection: this.connection,
      stack: this.stack,
      originalError: this.originalError
        ? {
          name: this.originalError.name,
          message: this.originalError.message,
        }
        : undefined,
    };
  }
}

/**
 * 连接错误类（便捷构造函数）
 */
export function createConnectionError(
  message: string,
  options: {
    code?: DatabaseErrorCode;
    connection?: string;
    originalError?: Error;
  } = {},
): DatabaseError {
  return new DatabaseError(message, {
    code: options.code || DatabaseErrorCode.CONNECTION_FAILED,
    connection: options.connection,
    originalError: options.originalError,
  });
}

/**
 * 查询错误类（便捷构造函数）
 */
export function createQueryError(
  message: string,
  options: {
    code?: DatabaseErrorCode;
    sql?: string;
    params?: any[];
    connection?: string;
    originalError?: Error;
  } = {},
): DatabaseError {
  return new DatabaseError(message, {
    code: options.code || DatabaseErrorCode.QUERY_FAILED,
    sql: options.sql,
    params: options.params,
    connection: options.connection,
    originalError: options.originalError,
  });
}

/**
 * 执行错误类（便捷构造函数）
 */
export function createExecuteError(
  message: string,
  options: {
    code?: DatabaseErrorCode;
    sql?: string;
    params?: any[];
    connection?: string;
    originalError?: Error;
  } = {},
): DatabaseError {
  return new DatabaseError(message, {
    code: options.code || DatabaseErrorCode.EXECUTE_FAILED,
    sql: options.sql,
    params: options.params,
    connection: options.connection,
    originalError: options.originalError,
  });
}

/**
 * 事务错误类（便捷构造函数）
 */
export function createTransactionError(
  message: string,
  options: {
    code?: DatabaseErrorCode;
    sql?: string;
    connection?: string;
    originalError?: Error;
  } = {},
): DatabaseError {
  return new DatabaseError(message, {
    code: options.code || DatabaseErrorCode.TRANSACTION_FAILED,
    sql: options.sql,
    connection: options.connection,
    originalError: options.originalError,
  });
}

/**
 * 配置错误类（便捷构造函数）
 */
export function createConfigError(
  message: string,
  options: {
    code?: DatabaseErrorCode;
    originalError?: Error;
  } = {},
): DatabaseError {
  return new DatabaseError(message, {
    code: options.code || DatabaseErrorCode.CONFIG_INVALID,
    originalError: options.originalError,
  });
}
