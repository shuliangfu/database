# 数据库 ORM 设计分析

## 一、架构设计

采用适配器模式，统一接口，支持多种数据库：

```
DatabaseManager (统一管理器)
    ├── DatabaseAdapter (接口)
    │   ├── BaseAdapter (抽象基类)
    │   ├── MongoDBAdapter
    │   ├── MariaDBAdapter
    │   ├── PostgreSQLAdapter
    │   └── SQLiteAdapter
    ├── QueryBuilder (查询构建器)
    │   ├── SQLQueryBuilder
    │   └── MongoQueryBuilder
    ├── Model (ORM 模型)
    │   ├── SQLModel (MySQL/MariaDB/PostgreSQL/SQLite 共用)
    │   └── MongoModel
    ├── Migration (迁移工具)
    ├── Cache (缓存适配器)
    └── Logger (查询日志)
```

## 二、npm 依赖选择

### 2.1 MongoDB
```json
"mongodb": "npm:mongodb@^7.0.0"
```
- 官方驱动，Deno/Bun 兼容
- 支持连接池、事务

### 2.2 MariaDB
```json
"mysql2": "npm:mysql2@^3.16.0"
```
- MariaDB 与 MySQL 兼容
- 支持 Promise、连接池
- 注意：避免使用 https:// 开头的包（JSR 不支持）

### 2.3 PostgreSQL
```json
"pg": "npm:pg@^8.16.3"
```
- 官方驱动，稳定可靠
- 支持连接池、预处理语句

### 2.4 SQLite
```json
"better-sqlite3": "npm:better-sqlite3@^11.0.0"
```
- 高性能 SQLite 驱动
- 同步 API，性能优异
- 支持事务、预处理语句
- 注意：SQLite 是文件数据库，不需要连接池

## 三、核心功能设计

### 3.1 统一接口
```typescript
interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<void>;
  close(): Promise<void>;
  // SQL: query(sql: string, params?: any[]): Promise<any[]>
  // MongoDB: query(collection: string, filter?: any, options?: any): Promise<any[]>
  query(sqlOrCollection: string, paramsOrFilter?: any[] | any, options?: any): Promise<any[]>;
  // SQL: execute(sql: string, params?: any[]): Promise<any>
  // MongoDB: execute(operation: string, collection: string, data: any): Promise<any>
  execute(sqlOrOperation: string, paramsOrCollection?: any[] | string, data?: any): Promise<any>;
  transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
  isConnected(): boolean;
  getPoolStatus(): Promise<PoolStatus>;
  healthCheck(): Promise<HealthCheckResult>;
}
```

### 3.1.1 基础适配器抽象类
```typescript
abstract class BaseAdapter implements DatabaseAdapter {
  protected config: DatabaseConfig | null = null;
  protected connected: boolean = false;
  protected queryLogger: QueryLogger | null = null;

  // 抽象方法（由子类实现）
  abstract connect(config: DatabaseConfig): Promise<void>;
  abstract query(...args: any[]): Promise<any[]>;
  abstract execute(...args: any[]): Promise<any>;
  abstract transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
  abstract close(): Promise<void>;
  abstract getPoolStatus(): Promise<PoolStatus>;
  abstract healthCheck(): Promise<HealthCheckResult>;

  // 通用方法
  isConnected(): boolean;
  validateConfig(config: DatabaseConfig): void;
  setQueryLogger(logger: QueryLogger): void;
}
```

### 3.2 统一配置接口
```typescript
interface DatabaseConfig {
  type: "postgresql" | "mongodb" | "mysql" | "sqlite";
  connection: {
    // SQL 数据库（PostgreSQL、MySQL/MariaDB）
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    // SQLite 特定（文件路径）
    filename?: string;
    // MongoDB 特定
    authSource?: string;
    replicaSet?: string;
  };
  // SQL 数据库连接池配置（PostgreSQL、MySQL/MariaDB）
  pool?: {
    min?: number;
    max?: number;
    idleTimeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  // SQLite 特定配置
  sqliteOptions?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: boolean;
  };
  // MongoDB 特定配置
  mongoOptions?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    timeoutMS?: number;
    maxRetries?: number;
    retryDelay?: number;
    authSource?: string;
    replicaSet?: string;
  };
}
```

### 3.3 ORM 模型

#### SQL 模型（MySQL、MariaDB、PostgreSQL、SQLite 共用）
```typescript
// 字段定义
interface FieldDefinition {
  type: FieldType;
  enum?: any[];
  default?: any;
  validate?: ValidationRule;
  get?: (value: any) => any;
  set?: (value: any) => any;
}

// 模型字段定义
type ModelSchema = {
  [fieldName: string]: FieldDefinition;
};

class SQLModel {
  static table: string;
  static primaryKey: string = 'id';
  static schema: ModelSchema; // 字段定义和验证规则

  // 查询方法
  static find(id: string | number): Promise<SQLModel | null>;
  static findAll(): Promise<SQLModel[]>;
  static where(conditions: WhereCondition): SQLQueryBuilder;
  static first(): Promise<SQLModel | null>;

  // 创建/更新
  static create(data: Record<string, unknown>): Promise<SQLModel>;
  save(): Promise<this>;
  update(data: Record<string, unknown>): Promise<this>;

  // 删除
  delete(): Promise<void>;
  static destroy(id: string | number): Promise<void>;

  // 验证
  validate(): Promise<void>;
  static validateData(data: Record<string, unknown>): Promise<void>;
}
```

**说明**：MySQL、MariaDB、PostgreSQL 和 SQLite 都是关系型数据库，使用相同的 SQL 语法，因此共用 `SQLModel`。数据库特定的差异（如参数占位符、数据类型、自增主键语法）在适配器层处理。

#### MongoDB 模型
```typescript
class MongoModel {
  static collection: string;
  static schema: ModelSchema;

  // 查询方法
  static find(filter?: any): Promise<MongoModel[]>;
  static findOne(filter?: any): Promise<MongoModel | null>;
  static findById(id: string): Promise<MongoModel | null>;

  // 创建/更新
  static create(data: Record<string, unknown>): Promise<MongoModel>;
  save(): Promise<this>;
  update(data: Record<string, unknown>): Promise<this>;

  // 删除
  delete(): Promise<void>;
  static deleteMany(filter: any): Promise<number>;
}
```

### 3.4 查询构建器

#### SQL 查询构建器
```typescript
class SQLQueryBuilder {
  select(...fields: string[]): this;
  where(conditions: WhereCondition): this;
  whereIn(field: string, values: unknown[]): this;
  orderBy(field: string, direction: 'asc' | 'desc'): this;
  limit(count: number): this;
  offset(count: number): this;
  groupBy(...fields: string[]): this;
  execute(): Promise<unknown[]>;
  first(): Promise<unknown | null>;
  count(): Promise<number>;
  insert(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

// 查询条件类型
type WhereCondition = {
  [key: string]: any | {
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $ne?: any;
    $in?: any[];
    $like?: string;
  };
};
```

#### MongoDB 查询构建器
```typescript
class MongoQueryBuilder {
  find(filter?: any): this;
  where(conditions: MongoWhereCondition): this;
  sort(sort: Record<string, 1 | -1>): this;
  limit(count: number): this;
  skip(count: number): this;
  project(fields: Record<string, 0 | 1>): this;
  aggregate(pipeline: any[]): this;
  toArray(): Promise<unknown[]>;
  toCursor(): any;
}
```

## 四、实现步骤

### 阶段1：基础适配器
1. 定义 `DatabaseAdapter` 接口
2. 实现 `MongoDBAdapter`
3. 实现 `PostgreSQLAdapter`
4. 实现 `MariaDBAdapter`
5. 实现 `SQLiteAdapter`

### 阶段2：统一管理器
1. 实现 `DatabaseManager`
2. 实现连接管理
3. 实现基础查询方法

### 阶段3：查询构建器
1. 实现 `QueryBuilder` 基类
2. 实现关系型数据库查询构建器
3. 实现 MongoDB 查询构建器

### 阶段4：ORM 功能
1. 实现 `Model` 基类
2. 实现模型定义装饰器
3. 实现关联关系（可选）

## 五、项目结构

```
database/
├── src/
│   ├── mod.ts                    # 主入口（导出所有公共 API）
│   ├── manager.ts                # DatabaseManager（统一管理器）
│   ├── types.ts                  # 核心类型定义（DatabaseAdapter、DatabaseConfig 等）
│   ├── access.ts                 # 数据库访问辅助函数
│   ├── init-database.ts          # 数据库初始化工具
│   │
│   ├── adapter/                  # 数据库适配器
│   │   ├── base.ts               # BaseAdapter 抽象类
│   │   ├── mod.ts                # 适配器导出
│   │   ├── mongodb.ts            # MongoDB 适配器
│   │   ├── postgresql.ts         # PostgreSQL 适配器
│   │   ├── mysql.ts              # MySQL/MariaDB 适配器
│   │   └── sqlite.ts             # SQLite 适配器
│   │
│   ├── query/                    # 查询构建器
│   │   ├── mod.ts                # 查询构建器导出
│   │   ├── sql-builder.ts        # SQL 查询构建器
│   │   └── mongo-builder.ts      # MongoDB 查询构建器
│   │
│   ├── orm/                      # ORM 模型
│   │   ├── mod.ts                # ORM 模型导出
│   │   ├── sql-model.ts          # SQL 模型基类（MySQL/MariaDB/PostgreSQL/SQLite 共用）
│   │   └── mongo-model.ts        # MongoDB 模型基类
│   │
│   ├── migration/                # 数据库迁移
│   │   ├── mod.ts                # 迁移工具导出
│   │   ├── manager.ts            # 迁移管理器
│   │   ├── types.ts              # 迁移类型定义
│   │   └── utils.ts              # 迁移工具函数
│   │
│   ├── cache/                    # 缓存适配器
│   │   ├── mod.ts                # 缓存适配器导出
│   │   ├── cache-adapter.ts      # 缓存适配器接口
│   │   └── memory-cache.ts       # 内存缓存实现
│   │
│   ├── logger/                   # 查询日志
│   │   ├── mod.ts                # 查询日志导出
│   │   └── query-logger.ts       # 查询日志记录器
│   │
│   └── types/                    # 类型定义目录
│       └── index.ts              # 索引类型定义（IndexDefinitions 等）
│
├── deno.json                     # Deno 配置
└── README.md                     # 项目文档
```

## 六、使用示例

### 6.1 基础使用

#### PostgreSQL
```typescript
import { DatabaseManager, PostgreSQLAdapter } from "jsr:@dreamer/database";

const adapter = new PostgreSQLAdapter({
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "user",
  password: "password"
});

const db = new DatabaseManager(adapter);
await db.connect();
```

#### SQLite
```typescript
import { DatabaseManager, SQLiteAdapter } from "jsr:@dreamer/database";

const adapter = new SQLiteAdapter({
  filename: "./data.db"
});

const db = new DatabaseManager(adapter);
await db.connect();

// 查询（SQLite 使用文件路径，不需要连接池）
const users = await db.query("SELECT * FROM users WHERE age > ?", [18]);
```

#### 查询构建器（所有 SQL 数据库通用）
```typescript
const result = await db.table("users")
  .select("id", "name")
  .where("age", ">", 18)
  .orderBy("created_at", "desc")
  .limit(10)
  .execute();
```

### 6.2 ORM 使用
```typescript
import { Model } from "jsr:@dreamer/database";

class User extends Model {
  static table = "users";
  static primaryKey = "id";
}

// 查询
const user = await User.find(1);
const users = await User.where({ status: "active" }).execute();

// 创建
const newUser = await User.create({ name: "Alice", email: "alice@example.com" });

// 更新
user.name = "Bob";
await user.save();
```

## 七、MongoDB 特殊处理

### 7.1 查询差异
- MongoDB 使用 `collection()` 而非 `table()`
- 查询使用对象而非 SQL
- 支持聚合管道

```typescript
// MongoDB 查询
const users = await db.collection("users")
  .find({ age: { $gt: 18 } })
  .sort({ created_at: -1 })
  .limit(10)
  .toArray();

// 聚合查询
const result = await db.collection("users")
  .aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$department", count: { $sum: 1 } } }
  ])
  .toArray();
```

### 7.2 事务支持
MongoDB 4.0+ 支持事务，需要副本集或分片集群。

## 八、实现细节

### 8.1 连接管理
- 适配器负责连接生命周期
- DatabaseManager 管理适配器实例（支持多连接）
- 支持连接池配置
- **自动重连机制**：连接失败时自动重试（可配置重试次数和延迟）
- **健康检查**：定期检查连接健康状态，自动恢复不健康的连接
- **连接状态管理**：跟踪连接状态，确保操作前连接可用

### 8.2 错误处理
```typescript
class DatabaseError extends Error {
  code: string;
  sql?: string;
  params?: unknown[];
}

class ValidationError extends Error {
  field: string;
  message: string;
}
```

### 8.3 连接池和健康检查
```typescript
interface PoolStatus {
  total: number;      // 总连接数
  active: number;     // 活跃连接数
  idle: number;       // 空闲连接数
  waiting: number;    // 等待连接数
}

interface HealthCheckResult {
  healthy: boolean;
  latency?: number;   // 响应时间（毫秒）
  error?: string;
  timestamp: Date;
}
```

### 8.4 查询日志
```typescript
interface QueryLogEntry {
  query: string;
  params?: any[];
  duration: number;
  timestamp: Date;
  error?: Error;
}

class QueryLogger {
  log(entry: QueryLogEntry): void;
  getLogs(): QueryLogEntry[];
  clear(): void;
}
```

### 8.5 缓存支持
```typescript
interface CacheAdapter {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

## 九、关键实现要点

### 9.1 自动重连机制
- 连接失败时自动重试（默认 3 次）
- 支持指数退避策略（延迟递增）
- 可配置最大重试次数和重试延迟

### 9.2 健康检查
- 定期检查数据库连接健康状态（默认 30 秒）
- 连接不健康时自动重连
- 记录健康检查结果和响应时间

### 9.3 查询日志
- 记录所有查询操作（SQL、参数、执行时间）
- 支持查询日志记录器注入
- 可用于调试和性能分析

### 9.4 参数化查询
- SQL 数据库：使用 `?` 占位符，自动转换为数据库特定格式（PostgreSQL: `$1, $2...`）
- 防止 SQL 注入攻击
- MongoDB 使用查询对象，天然安全

## 十、优化建议（基于参考项目）

### 10.1 连接关闭优化
- **超时保护**：所有适配器的 `close()` 方法都应添加超时保护（3秒），避免阻塞
- **异步关闭**：MongoDB 可以在后台关闭，立即返回，不阻塞主流程
- **状态清理**：关闭时立即清理状态，避免后续操作使用已关闭的连接

```typescript
async close(): Promise<void> {
  if (this.connection) {
    const conn = this.connection;
    // 立即清理状态
    this.connection = null;
    this.connected = false;

    // 带超时的关闭
    try {
      await Promise.race([
        conn.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("关闭超时")), 3000)
        )
      ]);
    } catch (error) {
      console.warn(`关闭连接时出错: ${error}`);
    }
  }
}
```

### 10.2 参数转换优化
- **统一处理**：在 BaseAdapter 中提供通用的参数转换方法
- **数据库特定**：PostgreSQL 需要 `?` 转 `$1, $2...`，MySQL/MariaDB/SQLite 保持 `?`
- **类型安全**：参数转换时保持类型信息

```typescript
// BaseAdapter 中
protected convertParams(sql: string, dbType: string): string {
  if (dbType === 'postgresql') {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }
  return sql; // MySQL/MariaDB/SQLite 保持 ?
}
```

### 10.3 查询日志优化
- **统一格式**：所有数据库使用统一的日志格式
- **性能监控**：记录查询执行时间，便于性能分析
- **错误追踪**：记录错误查询的完整上下文

```typescript
interface QueryLogEntry {
  type: 'query' | 'execute';
  sql: string;
  params?: any[];
  duration: number;
  timestamp: Date;
  error?: Error;
  connection?: string;
}
```

### 10.4 模型功能增强
- **生命周期钩子**：支持 `beforeCreate`, `afterCreate`, `beforeUpdate` 等
- **查询作用域**：定义常用查询条件，便于复用
- **虚拟字段**：计算属性，不存储在数据库中
- **软删除**：支持软删除，不真正删除记录
- **时间戳管理**：自动管理 `createdAt` 和 `updatedAt`

```typescript
class User extends SQLModel {
  static tableName = 'users';

  // 生命周期钩子
  static async beforeCreate(instance: User) {
    instance.createdAt = new Date();
  }

  // 查询作用域
  static scopes = {
    active: () => ({ status: 'active' }),
    recent: () => ({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
  };

  // 虚拟字段
  static virtuals = {
    fullName: (user: User) => `${user.firstName} ${user.lastName}`
  };

  // 软删除
  static softDelete = true;

  // 时间戳
  static timestamps = true;
}
```

### 10.5 错误处理优化
- **错误分类**：区分连接错误、查询错误、验证错误
- **错误上下文**：包含 SQL、参数、连接信息等
- **错误恢复**：自动重试机制，可配置重试策略

```typescript
class DatabaseError extends Error {
  code: string;
  sql?: string;
  params?: any[];
  connection?: string;
  originalError?: Error;

  constructor(message: string, options: {
    code: string;
    sql?: string;
    params?: any[];
    connection?: string;
    originalError?: Error;
  }) {
    super(message);
    Object.assign(this, options);
  }
}
```

### 10.6 连接池状态优化
- **准确统计**：从数据库驱动获取真实的连接池状态
- **监控指标**：提供连接池使用率、等待时间等指标
- **告警机制**：连接池接近上限时发出警告

### 10.7 事务处理优化
- **统一接口**：所有数据库使用相同的事务接口
- **嵌套事务**：支持保存点（savepoint）实现嵌套事务
- **自动回滚**：错误时自动回滚，确保数据一致性

### 10.8 查询构建器优化
- **链式调用**：支持流畅的链式 API
- **条件构建**：支持对象形式的条件查询（`{ age: { $gt: 18 } }`）
- **查询缓存**：支持查询结果缓存，提高性能

## 十一、注意事项

1. **全部使用 npm 依赖**：避免 https:// 开头的包（JSR 不支持）
2. **类型安全**：完整的 TypeScript 类型支持
3. **错误处理**：统一的错误处理机制，区分数据库错误和验证错误
4. **连接池**：合理管理数据库连接，避免连接泄漏
5. **事务支持**：关系型数据库必须支持事务，MongoDB 需要副本集
6. **MongoDB 差异**：MongoDB 使用集合（collection）而非表（table），查询方式不同
7. **SQLite 特殊性**：SQLite 是文件数据库，使用文件路径连接，不需要连接池；支持同步 API，性能优异
8. **SQL 注入防护**：所有查询使用参数化查询
8. **性能优化**：合理使用连接池和查询缓存
9. **多连接支持**：DatabaseManager 支持管理多个数据库连接（通过名称区分）
10. **模型验证**：支持字段类型验证和自定义验证规则
11. **生命周期钩子**：支持模型生命周期钩子，便于扩展
12. **软删除**：支持软删除功能，保留历史数据
13. **时间戳管理**：自动管理创建和更新时间
14. **查询作用域**：支持定义常用查询条件
15. **虚拟字段**：支持计算属性，不存储在数据库
16. **连接超时保护**：关闭连接时添加超时保护，避免阻塞
17. **健康检查优化**：定期健康检查，自动恢复不健康的连接
18. **查询日志统一**：所有数据库使用统一的日志格式和接口
19. **错误上下文完整**：错误信息包含完整的上下文（SQL、参数、连接等）
20. **模型初始化懒加载**：模型适配器未设置时自动初始化
