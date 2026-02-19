/**
 * 数据库支持类型定义
 */

import type { Locale } from "./i18n.ts";

/**
 * 数据库类型
 * 支持的数据库类型：PostgreSQL、MongoDB、MySQL/MariaDB、SQLite
 */
export type DatabaseType = "postgresql" | "mongodb" | "mysql" | "sqlite";

/**
 * PostgreSQL 数据库配置
 */
export interface PostgreSQLConfig {
  /**
   * 数据库适配器
   */
  adapter: "postgresql";

  /**
   * 连接配置
   */
  connection: {
    /**
     * 数据库主机地址
     * 默认值：localhost
     */
    host?: string;

    /**
     * 数据库端口号
     * 默认值：5432
     */
    port?: number;

    /**
     * 数据库名称
     */
    database?: string;

    /**
     * 数据库用户名
     */
    username?: string;

    /**
     * 数据库密码
     */
    password?: string;
  };

  /**
   * 连接池配置
   */
  pool?: {
    /**
     * 连接池最小连接数
     * 默认值：1
     */
    min?: number;

    /**
     * 连接池最大连接数
     * 默认值：10
     */
    max?: number;

    /**
     * 空闲连接超时时间（秒）
     * 默认值：30
     */
    idleTimeout?: number;

    /**
     * 最大重试次数
     * 默认值：3
     */
    maxRetries?: number;

    /**
     * 重试延迟（毫秒）
     * 默认值：1000
     */
    retryDelay?: number;
  };

  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   */
  lang?: Locale;

  /**
   * PostgreSQL 特定配置
   */
  postgresqlOptions?: {
    /**
     * 连接超时时间（毫秒）
     * pg 库使用 connect_timeout（秒）参数
     * 默认值：5000
     */
    connectionTimeout?: number;
  };
}

/**
 * MySQL/MariaDB 数据库配置
 */
export interface MySQLConfig {
  /**
   * 数据库适配器
   */
  adapter: "mysql";

  /**
   * 连接配置
   */
  connection: {
    /**
     * 数据库主机地址
     * 默认值：localhost
     */
    host?: string;

    /**
     * 数据库端口号
     * 默认值：3306
     */
    port?: number;

    /**
     * 数据库名称
     */
    database?: string;

    /**
     * 数据库用户名
     */
    username?: string;

    /**
     * 数据库密码
     */
    password?: string;
  };

  /**
   * 连接池配置
   */
  pool?: {
    /**
     * 连接池最小连接数
     * 默认值：1
     */
    min?: number;

    /**
     * 连接池最大连接数
     * 默认值：10
     */
    max?: number;

    /**
     * 空闲连接超时时间（秒）
     * 默认值：30
     */
    idleTimeout?: number;

    /**
     * 最大重试次数
     * 默认值：3
     */
    maxRetries?: number;

    /**
     * 重试延迟（毫秒）
     * 默认值：1000
     */
    retryDelay?: number;
  };

  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   */
  lang?: Locale;

  /**
   * MySQL/MariaDB 特定配置
   */
  mysqlOptions?: {
    /**
     * 连接超时时间（毫秒）
     * 默认值：10000
     */
    connectionTimeout?: number;
  };
}

/**
 * MongoDB 数据库配置
 */
export interface MongoConfig {
  /**
   * 数据库适配器
   */
  adapter: "mongodb";

  /**
   * 连接配置
   */
  connection: {
    /**
     * 数据库主机地址
     * 默认值：localhost
     */
    host?: string;

    /**
     * 数据库端口号
     * 默认值：27017
     */
    port?: number;

    /**
     * 数据库名称
     */
    database?: string;

    /**
     * 数据库用户名
     */
    username?: string;

    /**
     * 数据库密码
     */
    password?: string;

    /**
     * MongoDB 认证源
     * 指定用于身份验证的数据库名称
     */
    authSource?: string;
  };

  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   */
  lang?: Locale;

  /**
   * MongoDB 特定配置
   */
  mongoOptions?: {
    /**
     * 连接池最大连接数
     * 默认值：根据 MongoDB 驱动默认值
     */
    maxPoolSize?: number;

    /**
     * 连接池最小连接数
     * 默认值：根据 MongoDB 驱动默认值
     */
    minPoolSize?: number;

    /**
     * 服务器选择超时时间（毫秒）
     * 默认值：30000
     */
    serverSelectionTimeoutMS?: number;

    /**
     * 连接超时时间（毫秒）
     * 建立 TCP 连接到服务器的超时时间
     * 默认值：5000（适配器默认值）
     */
    connectTimeoutMS?: number;

    /**
     * Socket 超时时间（毫秒）
     * Socket 在连接建立后等待活动的超时时间（0 表示无超时）
     * 默认值：5000（适配器默认值）
     */
    socketTimeoutMS?: number;

    /**
     * 最大重试次数
     * 默认值：3
     */
    maxRetries?: number;

    /**
     * 重试延迟（毫秒）
     * 默认值：1000
     */
    retryDelay?: number;

    /**
     * MongoDB 认证源
     * 指定用于身份验证的数据库名称
     * 如果未设置，将从连接字符串中获取
     */
    authSource?: string;

    /**
     * MongoDB 副本集名称
     *
     * **重要：如果 MongoDB 开启了副本集，必须设置此参数！**
     *
     * 如果不设置此参数，即使 MongoDB 开启了副本集：
     * - 连接 URL 中不会包含 replicaSet 参数
     * - directConnection 默认为 false（因为没有设置 replicaSet）
     * - MongoDB 驱动会尝试连接到指定的节点，然后从该节点获取副本集配置
     * - 如果副本集配置中包含无法解析的节点地址（如容器内部主机名），就会卡住
     *
     * **使用建议：**
     * - 如果 MongoDB 开启了副本集（即使是单节点副本集），必须设置此参数
     * - 例如：`replicaSet: "rs0"`
     * - 设置后，directConnection 默认会设置为 true，避免连接卡住
     *
     * @example
     * ```typescript
     * // 单节点副本集（Docker 开发环境）
     * await adapter.connect({
     *   adapter: "mongodb",
     *   connection: { host: "localhost", port: 27017, database: "mydb" },
     *   mongoOptions: {
     *     replicaSet: "rs0", // 必须设置，即使只有一个节点
     *     // directConnection 默认为 true，避免卡住
     *   },
     * });
     * ```
     */
    replicaSet?: string;

    /**
     * 查询结果中 date 字段的展示时区（IANA 时区名）
     * 配置后，MongoModel 在构建查询结果时会自动将所有 date 类型字段格式化为该时区的本地时间字符串，
     * 无需在 schema 的每个 date 字段上单独写 get。
     * 不配置则保持 Date 对象，由业务层自行格式化。
     * 常用值：如 "Asia/Shanghai"、PRC（与 Asia/Shanghai 等价）等。
     */
    timezone?: string;

    /**
     * 是否使用直接连接模式
     *
     * **为什么需要这个选项？**
     *
     * 当 `directConnection: false`（默认）时，MongoDB 驱动会：
     * 1. 连接到指定的节点
     * 2. 从该节点获取副本集的完整配置（包括所有节点的地址）
     * 3. 尝试连接到副本集中的所有节点
     *
     * **问题场景（Docker 单节点副本集）：**
     * - 副本集配置中可能包含多个节点的地址（如 `mongo-rs0-1:27017`, `mongo-rs0-2:27017`）
     * - 这些地址是容器内部主机名，客户端无法从外部解析
     * - 驱动尝试连接这些无法解析的节点时，会卡在 DNS 解析或连接超时
     * - 即使实际只有一个节点运行，驱动也会尝试连接配置中的所有节点
     *
     * **解决方案：**
     * - `directConnection: true` 强制只连接指定的 `host:port`，不尝试发现其他节点
     * - 这样可以避免解析容器内部主机名的问题
     * - 但代价是无法使用分布式节点的高可用特性
     *
     * **配置说明：**
     * - `true`：直接连接到指定的 host:port，不尝试发现副本集中的其他节点
     *   适用于单节点副本集或 Docker 环境，可以避免解析容器内部主机名
     *   注意：此模式下无法使用分布式节点，只能连接到指定的单个节点
     *
     * - `false`：MongoDB 驱动会自动发现并连接到副本集中的所有节点
     *   适用于真正的分布式副本集环境，可以实现高可用和负载均衡
     *   注意：需要确保所有节点地址都可以从客户端访问
     *
     * **默认值：**
     * - 如果配置了 `replicaSet` 则为 `true`（单节点模式，避免 Docker 环境卡住）
     * - 否则为 `false`（自动发现模式）
     *
     * **使用建议：**
     * - 单节点副本集（如 Docker 开发环境）：使用默认值或显式设置 `directConnection: true`
     * - 分布式副本集（生产环境）：显式设置 `directConnection: false` 以启用节点自动发现
     */
    directConnection?: boolean;
  };
}

/**
 * SQLite 数据库配置
 */
export interface SQLiteConfig {
  /**
   * 数据库适配器
   */
  adapter: "sqlite";

  /**
   * 连接配置
   */
  connection: {
    /**
     * SQLite 数据库文件路径
     * 示例：":memory:"（内存数据库）或 "/path/to/database.db"
     */
    filename?: string;
  };

  /**
   * 语言（可选，用于 i18n；不传则按环境 LANGUAGE/LC_ALL/LANG 检测）
   */
  lang?: Locale;

  /**
   * SQLite 特定配置
   */
  sqliteOptions?: {
    /**
     * 是否只读模式
     * 设置为 true 时，数据库将以只读模式打开
     * 默认值：false
     */
    readonly?: boolean;

    /**
     * 文件必须存在
     * 设置为 true 时，如果数据库文件不存在将抛出错误
     * 默认值：false
     */
    fileMustExist?: boolean;

    /**
     * 操作超时时间（毫秒）
     * 数据库操作的超时时间
     * 默认值：5000
     */
    timeout?: number;

    /**
     * 是否启用详细日志
     * 设置为 true 时，将输出详细的 SQL 日志
     * 默认值：false
     */
    verbose?: boolean;
  };
}

/**
 * 数据库连接配置（联合类型）
 * 用于向后兼容，推荐使用具体的配置类型（PostgreSQLConfig、MySQLConfig、MongoConfig、SQLiteConfig）
 */
export type DatabaseConfig =
  | PostgreSQLConfig
  | MySQLConfig
  | MongoConfig
  | SQLiteConfig;

/**
 * 数据库适配器接口
 * 所有数据库适配器必须实现此接口
 *
 * 注意：MongoDB 适配器的 query 和 execute 方法签名略有不同
 * - SQL 数据库: query(sql: string, params?: any[]): Promise<any[]>
 * - MongoDB: query(collection: string, filter?: any, options?: any): Promise<any[]>
 * - SQL 数据库: execute(sql: string, params?: any[]): Promise<any>
 * - MongoDB: execute(operation: string, collection: string, data: any): Promise<any>
 */
export interface DatabaseAdapter {
  /**
   * 连接数据库
   * 根据提供的配置连接到数据库
   *
   * @param config 数据库连接配置（PostgreSQLConfig、MySQLConfig、MongoConfig 或 SQLiteConfig）
   * @throws {DatabaseError} 连接失败时抛出错误
   */
  connect(config: DatabaseConfig): Promise<void>;

  /**
   * 执行查询（返回结果集）
   *
   * SQL 数据库用法：
   * - query(sql: string, params?: any[]): Promise<any[]>
   * - 示例：query("SELECT * FROM users WHERE age > ?", [18])
   *
   * MongoDB 用法：
   * - query(collection: string, filter?: any, options?: any): Promise<any[]>
   * - 示例：query("users", { age: { $gt: 18 } })
   *
   * @param sqlOrCollection SQL 查询语句或 MongoDB 集合名称
   * @param paramsOrFilter SQL 查询参数或 MongoDB 查询过滤器
   * @param options MongoDB 查询选项（仅 MongoDB 使用）
   * @returns 查询结果数组
   * @throws {DatabaseError} 查询失败时抛出错误
   */
  query(
    sqlOrCollection: string,
    paramsOrFilter?: any[] | any,
    options?: any,
  ): Promise<any[]>;

  /**
   * 执行更新/插入/删除（返回影响行数等信息）
   *
   * SQL 数据库用法：
   * - execute(sql: string, params?: any[]): Promise<any>
   * - 示例：execute("INSERT INTO users (name) VALUES (?)", ["Alice"])
   * - 返回：{ affectedRows: number, insertId?: number, rows?: any[] }
   *
   * MongoDB 用法：
   * - execute(operation: string, collection: string, data: any): Promise<any>
   * - 示例：execute("insert", "users", { name: "Alice", age: 25 })
   * - operation 支持：insert, insertMany, update, updateMany, delete, deleteMany
   * - 返回：MongoDB 操作结果对象
   *
   * @param sqlOrOperation SQL 语句或 MongoDB 操作类型
   * @param paramsOrCollection SQL 查询参数或 MongoDB 集合名称
   * @param data MongoDB 操作数据（仅 MongoDB 使用）
   * @returns 操作结果（影响行数、插入 ID 等）
   * @throws {DatabaseError} 执行失败时抛出错误
   */
  execute(
    sqlOrOperation: string,
    paramsOrCollection?: any[] | string,
    data?: any,
  ): Promise<any>;

  /**
   * 执行事务
   * 在事务上下文中执行回调函数，如果回调函数抛出错误，事务将自动回滚
   *
   * @param callback 事务回调函数，接收数据库适配器实例作为参数
   * @returns 回调函数的返回值
   * @throws {DatabaseError} 事务失败时抛出错误
   *
   * @example
   * ```typescript
   * await adapter.transaction(async (db) => {
   *   await db.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [100, 1]);
   *   await db.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [100, 2]);
   * });
   * ```
   */
  transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;

  /**
   * 创建保存点（用于嵌套事务）
   * 在事务中创建一个保存点，可以用于实现嵌套事务
   *
   * 注意：
   * - 此方法需要在事务上下文中调用
   * - 不是所有数据库都支持保存点（MongoDB 不支持）
   * - 如果不支持，将抛出 TRANSACTION_SAVEPOINT_FAILED 错误
   *
   * @param name 保存点名称
   * @throws {DatabaseError} 创建保存点失败时抛出错误
   */
  createSavepoint(name: string): Promise<void>;

  /**
   * 回滚到保存点（用于嵌套事务）
   * 回滚到指定的保存点，撤销保存点之后的所有操作
   *
   * 注意：
   * - 此方法需要在事务上下文中调用
   * - 保存点必须已经创建
   * - 不是所有数据库都支持保存点（MongoDB 不支持）
   *
   * @param name 保存点名称
   * @throws {DatabaseError} 回滚失败时抛出错误
   */
  rollbackToSavepoint(name: string): Promise<void>;

  /**
   * 释放保存点（用于嵌套事务）
   * 释放指定的保存点，保存点之后的操作将被提交
   *
   * 注意：
   * - 此方法需要在事务上下文中调用
   * - 保存点必须已经创建
   * - 不是所有数据库都支持保存点（MongoDB 不支持）
   *
   * @param name 保存点名称
   * @throws {DatabaseError} 释放保存点失败时抛出错误
   */
  releaseSavepoint(name: string): Promise<void>;

  /**
   * 关闭数据库连接
   * 关闭与数据库的连接，释放所有资源
   *
   * 注意：关闭后需要重新调用 connect() 才能继续使用
   *
   * @throws {DatabaseError} 关闭连接失败时抛出错误
   */
  close(): Promise<void>;

  /**
   * 检查是否已连接到数据库
   *
   * @returns 如果已连接返回 true，否则返回 false
   */
  isConnected(): boolean;

  /**
   * 获取连接池状态
   * 返回当前连接池的统计信息
   *
   * @returns 连接池状态对象，包含总连接数、活跃连接数、空闲连接数、等待连接数
   */
  getPoolStatus(): Promise<import("./adapters/base.ts").PoolStatus>;

  /**
   * 健康检查
   * 检查数据库连接的健康状态
   *
   * @returns 健康检查结果，包含健康状态、延迟时间、错误信息等
   */
  healthCheck(): Promise<import("./adapters/base.ts").HealthCheckResult>;

  /**
   * 设置查询日志记录器
   * 用于记录数据库查询和执行操作的日志
   *
   * @param logger 查询日志记录器实例
   */
  setQueryLogger(logger: import("./adapters/base.ts").QueryLogger): void;

  /**
   * 获取查询日志记录器
   *
   * @returns 当前设置的查询日志记录器，如果未设置则返回 null
   */
  getQueryLogger(): import("./adapters/base.ts").QueryLogger | null;

  /**
   * 获取底层数据库实例（如果适用）
   * 主要用于 MongoDB 适配器，返回 MongoDB 的 Db 实例
   * 其他适配器返回 null
   *
   * @returns 底层数据库实例，如果不适用则返回 null
   */
  getDatabase(): any | null;

  /**
   * 获取查询结果中 date 字段的展示时区（可选）
   * 仅 MongoDB 适配器可返回配置的 mongoOptions.timezone，用于将查询结果中的 Date 自动格式化为该时区字符串。
   *
   * @returns IANA 时区名（如 "Asia/Shanghai"、PRC），未配置则返回 undefined
   */
  getTimezone?(): string | undefined;
}
