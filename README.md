# @dreamer/database

> 一个兼容 Deno 和 Bun 的数据库工具库，提供多数据库支持、查询构建器、ORM/ODM、迁移管理等功能

[![JSR](https://jsr.io/badges/@dreamer/database)](https://jsr.io/@dreamer/database)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 功能

数据库工具库，提供统一的数据库抽象层，支持多种数据库后端，用于数据持久化、ORM/ODM、数据库迁移等场景。

---

## ✨ 特性

- **多数据库适配器**：
  - PostgreSQL 适配器（PostgreSQLAdapter）
  - MySQL/MariaDB 适配器（MySQLAdapter）
  - SQLite 适配器（SQLiteAdapter，支持 Bun 原生 API）
  - MongoDB 适配器（MongoDBAdapter）
  - 统一的数据库接口（DatabaseAdapter）
  - 运行时切换数据库后端
  - 多数据库实例支持（同时使用多个数据库）

- **ORM/ODM 功能**：
  - SQLModel - 关系型数据库 ORM（PostgreSQL、MySQL、SQLite）
  - MongoModel - MongoDB ODM
  - 链式查询构建器（流畅的查询 API）
  - 数据验证：
    - 基础验证：required、type、min、max、length、pattern、enum、custom
    - 跨字段验证：equals（字段相等）、notEquals（字段不相等）、compare（自定义比较函数）
    - 数据库查询验证：unique（唯一性）、exists（存在性）、notExists（不存在性）
  - 生命周期钩子（beforeCreate、afterCreate、beforeUpdate、afterUpdate 等）
  - 软删除支持
  - 查询结果缓存
  - 关联关系（belongsTo、hasOne、hasMany）

- **查询构建器**：
  - SQLQueryBuilder - 关系型数据库查询构建器
  - MongoQueryBuilder - MongoDB 查询构建器
  - 链式 API（流畅的链式查询语法）
  - 类型安全（完整的 TypeScript 类型支持）

- **迁移管理**：
  - MigrationManager - 数据库迁移管理工具
  - SQL 迁移支持
  - MongoDB 迁移支持
  - 迁移历史跟踪
  - 迁移回滚支持

- **其他功能**：
  - 事务支持（基本事务、嵌套事务、保存点）
  - 连接池管理
  - 查询日志记录（支持日志级别过滤、慢查询检测）
  - 健康检查
  - 数据库初始化工具（支持自动初始化、配置加载）
  - 预处理语句（防止 SQL 注入）

---

## 🎨 设计原则

**所有 @dreamer/* 库都遵循以下原则**：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno 和 Bun 运行时）
- **统一接口**：使用适配器模式，提供统一的数据库接口，支持多种数据库后端
- **类型安全**：完整的 TypeScript 类型支持
- **跨运行时**：支持 Deno 2.6+ 和 Bun 1.3.5

---

## 🎯 使用场景

- **关系型数据库操作**：PostgreSQL、MySQL、SQLite 数据持久化
- **MongoDB 文档数据库操作**：MongoDB 集合操作和查询
- **ORM/ODM 开发**：使用模型进行数据库操作
- **多数据库项目**：同时使用关系型数据库和 MongoDB
- **数据库迁移**：数据库结构版本管理和迁移
- **事务处理**：复杂业务逻辑的事务支持
- **查询优化**：使用查询构建器优化查询性能

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/database
```

### Bun

```bash
bunx jsr add @dreamer/database
```

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Deno** | 2.5+ | ✅ 完全支持 |
| **Bun** | 1.0+ | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（兼容 Deno 和 Bun 运行时，需要数据库驱动） |
| **客户端** | - | ❌ 不支持（浏览器环境无法直接连接数据库） |
| **依赖** | - | 📦 需要相应的数据库驱动（PostgreSQL、MySQL、SQLite、MongoDB） |

---

## 🚀 快速开始

### 基础数据库操作

```typescript
import {
  DatabaseManager,
  SQLiteAdapter,
} from "jsr:@dreamer/database";

// 创建 SQLite 适配器
const sqliteAdapter = new SQLiteAdapter();
await sqliteAdapter.connect({
  type: "sqlite",
  connection: {
    filename: ":memory:", // 或文件路径
  },
});

// 创建数据库管理器
const db = new DatabaseManager(sqliteAdapter);

// 执行 SQL 查询
const users = await db.query(
  "SELECT * FROM users WHERE age > ?",
  [18]
);

// 使用查询构建器
const result = await db.table("users")
  .select("id", "name", "email")
  .where("age", ">", 18)
  .orderBy("created_at", "desc")
  .limit(10)
  .execute();

// 事务支持
await db.transaction(async (trx) => {
  await trx.execute("INSERT INTO users (name, email) VALUES (?, ?)", [
    "Alice",
    "alice@example.com",
  ]);
  await trx.execute("INSERT INTO orders (user_id, amount) VALUES (?, ?)", [
    1,
    100,
  ]);
});

// 嵌套事务（保存点）- 仅支持 SQLite、PostgreSQL、MySQL
await db.transaction(async (trx) => {
  await trx.execute("INSERT INTO users (name, email) VALUES (?, ?)", [
    "Bob",
    "bob@example.com",
  ]);

  // 创建保存点
  const savepointId = await trx.createSavepoint("sp1");
  try {
    await trx.execute("INSERT INTO orders (user_id, amount) VALUES (?, ?)", [
      2,
      200,
    ]);
    // 释放保存点
    await trx.releaseSavepoint(savepointId);
  } catch (error) {
    // 回滚到保存点
    await trx.rollbackToSavepoint(savepointId);
    throw error;
  }
});
```

### MongoDB 操作

```typescript
import { MongoDBAdapter, DatabaseManager } from "jsr:@dreamer/database";

const mongoAdapter = new MongoDBAdapter();
await mongoAdapter.connect({
  type: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
});

const db = new DatabaseManager(mongoAdapter);

// MongoDB 查询
const users = await db.collection("users")
  .find({ age: { $gt: 18 } })
  .sort({ created_at: -1 })
  .limit(10)
  .toArray();
```

### SQLModel ORM

```typescript
import { SQLModel, SQLiteAdapter } from "jsr:@dreamer/database";

// 定义用户模型
class User extends SQLModel {
  static override tableName = "users";
  static override primaryKey = "id";

  // 定义字段和验证规则
  static override schema: ModelSchema = {
    name: {
      type: "string",
      validate: {
        required: true,
        max: 100,
      },
    },
    email: {
      type: "string",
      validate: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        unique: true, // 邮箱必须唯一
      },
    },
    age: {
      type: "number",
      validate: {
        min: 0,
        max: 150,
      },
    },
    password: {
      type: "string",
      validate: {
        required: true,
        min: 8,
      },
    },
    confirmPassword: {
      type: "string",
      validate: {
        required: true,
        equals: "password", // 必须与 password 字段相等
      },
    },
  };

  // 生命周期钩子
  static override beforeCreate(data: any) {
    data.created_at = new Date();
    return data;
  }
}

// 方式1：先初始化数据库连接（推荐）
import { initDatabase } from "jsr:@dreamer/database";
await initDatabase({
  type: "sqlite",
  connection: { filename: ":memory:" },
});
// 然后初始化模型（设置适配器）
await User.init();

// 方式2：使用指定连接名称
await initDatabase({
  type: "sqlite",
  connection: { filename: ":memory:" },
}, "secondary");
await User.init("secondary");

// 方式3：手动创建适配器并设置
// const adapter = new SQLiteAdapter();
// await adapter.connect({
//   type: "sqlite",
//   connection: { filename: ":memory:" },
// });
// User.setAdapter(adapter);

// 创建用户
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
});

// 查询用户
const foundUser = await User.findById(user.id);
const users = await User.query()
  .where("age", ">", 18)
  .sort("created_at", "desc")
  .findAll();

// 更新用户
await User.updateById(user.id, { age: 26 });

// 删除用户（软删除）
await User.deleteById(user.id);
```

### MongoModel ODM

```typescript
import {
  MongoModel,
  MongoDBAdapter,
  initDatabaseFromConfig,
} from "jsr:@dreamer/database";

// 定义文章模型
class Article extends MongoModel {
  static override collectionName = "articles";
  static override primaryKey = "_id";

  static override schema: ModelSchema = {
    title: {
      type: "string",
      required: true,
      maxLength: 200,
    },
    content: {
      type: "string",
      required: true,
    },
    status: {
      type: "string",
      enum: ["draft", "published", "archived"],
    },
  };

  // 作用域查询
  static published() {
    return this.query().where("status", "published");
  }
}

// 方式1：先初始化数据库连接（推荐）
import { initDatabase } from "jsr:@dreamer/database";
await initDatabase({
  type: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
});
// 然后初始化模型（设置适配器）
await Article.init();

// 方式2：使用指定连接名称
await initDatabase({
  type: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
}, "secondary");
await Article.init("secondary");

// 方式3：手动创建适配器并设置
// const adapter = new MongoDBAdapter();
// await adapter.connect({
//   type: "mongodb",
//   connection: {
//     host: "localhost",
//     port: 27017,
//     database: "mydb",
//   },
// });
// Article.setAdapter(adapter);

// 创建文章
const article = await Article.create({
  title: "Hello World",
  content: "This is my first article",
  status: "published",
});

// 使用作用域查询
const publishedArticles = await Article.published()
  .sort("created_at", -1)
  .findAll();

// 批量操作
await Article.incrementMany(
  { status: "published" },
  { views: 1 }
);
```

### 迁移管理

```typescript
import {
  MigrationManager,
  SQLiteAdapter,
} from "jsr:@dreamer/database";

// 创建适配器
const adapter = new SQLiteAdapter();
await adapter.connect({
  type: "sqlite",
  connection: { filename: "./app.db" },
});

// 创建迁移管理器
const manager = new MigrationManager({
  migrationsDir: "./migrations",
  adapter: adapter,
});

// 创建新的迁移文件
await manager.create("create_users_table");

// 执行待执行的迁移
await manager.up();

// 执行指定数量的迁移
await manager.up(2);

// 回滚最近的迁移
await manager.down();

// 回滚指定数量的迁移
await manager.down(2);

// 查看迁移状态
const status = await manager.status();
console.log(status);
```

### 运行时切换数据库后端

```typescript
import {
  DatabaseManager,
  SQLiteAdapter,
  MongoDBAdapter,
} from "jsr:@dreamer/database";

const sqliteAdapter = new SQLiteAdapter();
await sqliteAdapter.connect({
  type: "sqlite",
  connection: { filename: ":memory:" },
});

const mongoAdapter = new MongoDBAdapter();
await mongoAdapter.connect({
  type: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
});

const db = new DatabaseManager(sqliteAdapter);

// 使用 SQLite
await db.query("SELECT * FROM users");

// 切换到 MongoDB
db.setAdapter(mongoAdapter);

// 现在使用 MongoDB
await db.collection("users").find({}).toArray();
```

---

## 📚 API 文档

### 数据库适配器接口

所有数据库适配器都实现统一的接口：

```typescript
interface DatabaseAdapter {
  // 连接数据库
  connect(config: DatabaseConfig): Promise<void>;

  // 执行查询（返回结果集）
  query(sqlOrCollection: string, paramsOrFilter?: any[] | any, options?: any): Promise<any[]>;

  // 执行更新/插入/删除（返回影响行数等信息）
  execute(sqlOrOperation: string, paramsOrCollection?: any[] | string, data?: any): Promise<any>;

  // 执行事务
  transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;

  // 嵌套事务（保存点）- 仅支持 SQLite、PostgreSQL、MySQL
  createSavepoint(name: string): Promise<string>;
  rollbackToSavepoint(savepointId: string): Promise<void>;
  releaseSavepoint(savepointId: string): Promise<void>;

  // 关闭连接
  close(): Promise<void>;

  // 检查是否已连接
  isConnected(): boolean;

  // 获取连接池状态
  getPoolStatus(): Promise<PoolStatus>;

  // 健康检查
  healthCheck(): Promise<HealthCheckResult>;
}
```

### PostgreSQLAdapter

PostgreSQL 数据库适配器。

**配置选项**：
- `host: string`: 数据库主机
- `port: number`: 数据库端口
- `database: string`: 数据库名称
- `user: string`: 用户名
- `password: string`: 密码
- `poolSize?: number`: 连接池大小

### MySQLAdapter

MySQL/MariaDB 数据库适配器。

**配置选项**：
- `host: string`: 数据库主机
- `port: number`: 数据库端口
- `database: string`: 数据库名称
- `user: string`: 用户名
- `password: string`: 密码
- `poolSize?: number`: 连接池大小

### SQLiteAdapter

SQLite 数据库适配器，支持 Bun 原生 SQLite API。

**配置选项**：
- `filename: string`: SQLite 数据库文件路径（`:memory:` 表示内存数据库）

### MongoDBAdapter

MongoDB 数据库适配器。

**配置选项**：
- `host: string`: MongoDB 主机
- `port: number`: MongoDB 端口
- `database: string`: 数据库名称
- `username?: string`: 用户名（可选）
- `password?: string`: 密码（可选）
- `options?: object`: MongoDB 连接选项

### DatabaseManager

数据库管理器，提供统一的数据库操作接口。

**方法**：
- `connect(name: string, config: DatabaseConfig): Promise<ConnectionStatus>`: 连接数据库
- `getConnection(name?: string): DatabaseAdapter`: 获取数据库连接
- `query(sql: string, params?: any[]): Promise<any[]>`: 执行 SQL 查询
- `queryOne(sql: string, params?: any[]): Promise<any | null>`: 执行单条查询
- `execute(sql: string, params?: any[]): Promise<any>`: 执行更新/插入/删除
- `transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T>`: 执行事务
- `table(name: string): SQLQueryBuilder`: 获取 SQL 查询构建器
- `collection(name: string): MongoQueryBuilder`: 获取 MongoDB 查询构建器
- `setAdapter(adapter: DatabaseAdapter): void`: 切换数据库适配器
- `close(name?: string): Promise<void>`: 关闭指定连接或所有连接
- `closeAll(): Promise<void>`: 关闭所有连接
- `hasConnection(name?: string): boolean`: 检查连接是否存在
- `getConnectionNames(): string[]`: 获取所有连接名称
- `setAdapterFactory(factory: AdapterFactory): void`: 设置适配器工厂（用于测试）

### 数据库初始化工具函数

数据库初始化工具函数，用于简化数据库连接的初始化和访问。

**主要函数**：

#### initDatabase

初始化数据库连接。

```typescript
initDatabase(config: DatabaseConfig, connectionName?: string): Promise<ConnectionStatus>
```

- `config: DatabaseConfig`: 数据库配置
- `connectionName?: string`: 连接名称（默认为 'default'）
- 返回: `Promise<ConnectionStatus>` 连接状态

#### initDatabaseFromConfig

从配置对象初始化数据库连接。

```typescript
initDatabaseFromConfig(config: DatabaseConfig, connectionName?: string): Promise<ConnectionStatus>
```

#### autoInitDatabase

自动初始化数据库（从环境变量或配置文件加载配置）。

```typescript
autoInitDatabase(connectionName?: string): Promise<ConnectionStatus>
```

#### getDatabaseManager

获取数据库管理器实例。

```typescript
getDatabaseManager(): DatabaseManager
```

#### isDatabaseInitialized

检查数据库是否已初始化。

```typescript
isDatabaseInitialized(connectionName?: string): boolean
```

#### hasConnection

检查指定连接是否存在。

```typescript
hasConnection(connectionName?: string): boolean
```

#### closeDatabase

关闭所有数据库连接。

```typescript
closeDatabase(): Promise<void>
```

#### setDatabaseConfigLoader

设置数据库配置加载器（用于自定义配置加载逻辑）。

```typescript
setDatabaseConfigLoader(loader: (connectionName?: string) => Promise<DatabaseConfig>): void
```

#### setupDatabaseConfigLoader

设置数据库配置加载器（便捷方法，别名）。

```typescript
setupDatabaseConfigLoader(loader: (connectionName?: string) => Promise<DatabaseConfig>): void
```

#### setDatabaseManager

设置数据库管理器实例（用于测试或自定义管理器）。

```typescript
setDatabaseManager(manager: DatabaseManager): void
```

### 数据库访问辅助函数

数据库访问辅助函数，提供便捷的数据库连接访问方式。

**主要函数**：

#### getDatabase

同步获取数据库连接（如果未初始化会抛出错误）。

```typescript
getDatabase(connectionName?: string): DatabaseAdapter
```

- `connectionName?: string`: 连接名称（默认为 'default'）
- 返回: `DatabaseAdapter` 数据库适配器实例

#### getDatabaseAsync

异步获取数据库连接（支持自动初始化）。

```typescript
getDatabaseAsync(connectionName?: string): Promise<DatabaseAdapter>
```

- `connectionName?: string`: 连接名称（默认为 'default'）
- 返回: `Promise<DatabaseAdapter>` 数据库适配器实例

**注意**：如果数据库未初始化，`getDatabaseAsync` 会尝试自动初始化（如果配置了自动初始化）。

### QueryLogger

查询日志记录器，用于记录和监控数据库查询。

**构造函数**：

```typescript
new QueryLogger(options?: QueryLoggerOptions)
```

**选项**：
- `enabled?: boolean`: 是否启用日志（默认 true）
- `logLevel?: "all" | "error" | "slow"`: 日志级别（默认 "all"）
- `slowQueryThreshold?: number`: 慢查询阈值（毫秒，默认 1000）
- `maxLogs?: number`: 最大日志数量（默认 1000）

**方法**：

- `log(type: string, sql: string, params?: any[], duration?: number, error?: Error): void`: 记录查询日志
- `getLogs(): QueryLogEntry[]`: 获取所有日志
- `clear(): void`: 清空日志
- `getLogger(): QueryLogger`: 获取 logger 实例（单例模式）

### SQLModel

关系型数据库 ORM 模型基类。

**静态方法**：
- `setAdapter(adapter: DatabaseAdapter): void`: 设置数据库适配器
- `init(connectionName?: string): Promise<void>`: 初始化模型（从已初始化的数据库连接中获取适配器并设置，不负责连接数据库）
- `create(data: any): Promise<ModelInstance>`: 创建记录
- `createMany(data: any[]): Promise<ModelInstance[]>`: 批量创建
- `find(conditions: WhereCondition): SQLQueryBuilder`: 查找记录（链式查询）
- `findById(id: any): Promise<ModelInstance | null>`: 通过 ID 查找
- `findOne(conditions: WhereCondition): Promise<ModelInstance | null>`: 查找单条记录
- `findAll(conditions?: WhereCondition): Promise<ModelInstance[]>`: 查找多条记录
- `update(conditions: WhereCondition, data: any): Promise<number>`: 更新记录
- `updateById(id: any, data: any): Promise<boolean>`: 通过 ID 更新
- `updateMany(conditions: WhereCondition, data: any): Promise<number>`: 批量更新
- `delete(conditions: WhereCondition): Promise<number>`: 删除记录
- `deleteById(id: any): Promise<boolean>`: 通过 ID 删除
- `deleteMany(conditions: WhereCondition): Promise<number>`: 批量删除
- `count(conditions?: WhereCondition): Promise<number>`: 统计记录数
- `exists(conditions: WhereCondition): Promise<boolean>`: 检查记录是否存在
- `paginate(page: number, perPage: number, conditions?: WhereCondition): Promise<PaginateResult>`: 分页查询
- `increment(conditions: WhereCondition, field: string, amount?: number): Promise<number>`: 增加字段值
- `decrement(conditions: WhereCondition, field: string, amount?: number): Promise<number>`: 减少字段值
- `upsert(conditions: WhereCondition, data: any): Promise<ModelInstance>`: 更新或插入
- `findOrCreate(conditions: WhereCondition, data: any): Promise<ModelInstance>`: 查找或创建
- `distinct(field: string, conditions?: WhereCondition): Promise<any[]>`: 获取唯一值列表
- `withTrashed(): QueryBuilder`: 包含已删除记录的查询
- `onlyTrashed(): QueryBuilder`: 仅查询已删除记录
- `restore(conditions: WhereCondition): Promise<number>`: 恢复软删除记录
- `forceDelete(conditions: WhereCondition): Promise<number>`: 强制删除记录
- `truncate(): Promise<number>`: 清空表
- `query(): SQLQueryBuilder`: 获取链式查询构建器

**链式查询构建器方法**（通过 `query()` 返回）：
- `where(condition: WhereCondition | number | string): SQLQueryBuilder`: 添加查询条件
- `fields(fields: string[]): SQLQueryBuilder`: 选择字段
- `sort(sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc"): SQLQueryBuilder`: 排序
- `skip(n: number): SQLQueryBuilder`: 跳过记录
- `limit(n: number): SQLQueryBuilder`: 限制记录数
- `includeTrashed(): SQLQueryBuilder`: 包含已删除记录
- `onlyTrashed(): SQLQueryBuilder`: 仅查询已删除记录
- `findAll(): Promise<ModelInstance[]>`: 执行查询并返回所有结果
- `findOne(): Promise<ModelInstance | null>`: 执行查询并返回第一条结果
- `one(): Promise<ModelInstance | null>`: 执行查询并返回第一条结果（别名）
- `all(): Promise<ModelInstance[]>`: 执行查询并返回所有结果（别名）
- `count(): Promise<number>`: 统计记录数
- `exists(): Promise<boolean>`: 检查记录是否存在
- `update(data: Record<string, any>): Promise<number>`: 更新记录
- `updateMany(data: Record<string, any>): Promise<number>`: 批量更新
- `increment(field: string, amount?: number): Promise<number>`: 增加字段值
- `decrement(field: string, amount?: number): Promise<number>`: 减少字段值
- `deleteMany(): Promise<number>`: 批量删除
- `restore(options?: { returnIds?: boolean }): Promise<number | { count: number; ids: any[] }>`: 恢复软删除记录
- `forceDelete(options?: { returnIds?: boolean }): Promise<number | { count: number; ids: any[] }>`: 强制删除记录
- `distinct(field: string): Promise<any[]>`: 获取唯一值列表
- `upsert(data: Record<string, any>): Promise<ModelInstance>`: 更新或插入
- `findOrCreate(data: Record<string, any>): Promise<ModelInstance>`: 查找或创建
- `findOneAndUpdate(data: Record<string, any>): Promise<ModelInstance | null>`: 查找并更新
- `findOneAndDelete(): Promise<ModelInstance | null>`: 查找并删除

**实例方法**：
- `save(): Promise<this>`: 保存实例
- `update(data: any): Promise<this>`: 更新实例
- `delete(): Promise<boolean>`: 删除实例
- `reload(): Promise<this>`: 重新加载实例
- `belongsTo(Model: typeof SQLModel, foreignKey?: string, localKey?: string): Promise<ModelInstance | null>`: 属于关系
- `hasOne(Model: typeof SQLModel, foreignKey?: string, localKey?: string): Promise<ModelInstance | null>`: 一对一关系
- `hasMany(Model: typeof SQLModel, foreignKey?: string, localKey?: string): Promise<ModelInstance[]>`: 一对多关系

**生命周期钩子**：
- `beforeCreate(data: any): any`: 创建前钩子
- `afterCreate(instance: any): void`: 创建后钩子
- `beforeUpdate(data: any, conditions: any): any`: 更新前钩子
- `afterUpdate(instance: any): void`: 更新后钩子
- `beforeSave(data: any): any`: 保存前钩子
- `afterSave(instance: any): void`: 保存后钩子
- `beforeDelete(conditions: any): void`: 删除前钩子
- `afterDelete(instance: any): void`: 删除后钩子
- `beforeValidate(data: any): any`: 验证前钩子
- `afterValidate(data: any): any`: 验证后钩子

**数据验证规则**：

基础验证：
- `required: boolean`: 必填字段
- `type: FieldType`: 字段类型
- `min: number`: 最小值（数字）或最小长度（字符串）
- `max: number`: 最大值（数字）或最大长度（字符串）
- `length: number`: 固定长度（字符串）
- `pattern: RegExp | string`: 正则表达式
- `enum: any[]`: 枚举值
- `custom: (value: any) => boolean | string`: 自定义验证函数

跨字段验证：
- `equals: string`: 与另一个字段值相等（字段名）
- `notEquals: string`: 与另一个字段值不相等（字段名）
- `compare: (value: any, allValues: Record<string, any>) => boolean | string`: 自定义字段比较函数

数据库查询验证（异步）：
- `unique: boolean | { exclude?: Record<string, any>, where?: Record<string, any> }`: 在数据表中唯一
- `exists: boolean | { table?: string, where?: Record<string, any> }`: 在数据表中存在
- `notExists: boolean | { table?: string, where?: Record<string, any> }`: 在数据表中不存在

高级验证功能：
- `when: { field: string, is?: any, isNot?: any, check?: (value, allValues) => boolean }`: 条件验证（根据其他字段值决定是否验证）
- `requiredWhen: { field: string, is?: any, isNot?: any, check?: (value, allValues) => boolean }`: 条件必填（根据条件决定是否必填）
- `asyncCustom: (value, allValues, context) => Promise<boolean | string>`: 异步自定义验证（可访问数据库）
- `groups: string[]`: 验证组（只在指定组中验证）
- `array: { type?, min?, max?, length?, items? }`: 数组验证（验证数组元素）
- `format: "email" | "url" | "ip" | "ipv4" | "ipv6" | "uuid" | "date" | "datetime" | "time"`: 内置格式验证器

**验证示例**：

```typescript
class User extends SQLModel {
  static override tableName = "users";
  static override schema: ModelSchema = {
    email: {
      type: "string",
      validate: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        unique: true, // 邮箱必须唯一
      },
    },
    password: {
      type: "string",
      validate: {
        required: true,
        min: 8,
      },
    },
    confirmPassword: {
      type: "string",
      validate: {
        required: true,
        equals: "password", // 必须与 password 字段相等
      },
    },
    startDate: {
      type: "date",
      validate: {
        required: true,
      },
    },
    endDate: {
      type: "date",
      validate: {
        required: true,
        compare: (value, allValues) => {
          // 结束日期必须大于开始日期
          if (value <= allValues.startDate) {
            return "结束日期必须大于开始日期";
          }
          return true;
        },
      },
    },
    categoryId: {
      type: "number",
      validate: {
        required: true,
        exists: true, // 必须在 categories 表中存在
      },
    },
    // 条件验证示例
    discountCode: {
      type: "string",
      validate: {
        when: {
          field: "hasDiscount",
          is: true, // 只有当 hasDiscount 为 true 时才验证
        },
        required: true,
      },
    },
    // 条件必填示例
    companyName: {
      type: "string",
      validate: {
        requiredWhen: {
          field: "userType",
          is: "company", // 当 userType 为 "company" 时必填
        },
      },
    },
    // 数组验证示例
    tags: {
      type: "array",
      validate: {
        array: {
          type: "string",
          min: 1,
          max: 10,
          items: {
            min: 2,
            max: 20,
          },
        },
      },
    },
    // 格式验证示例
    website: {
      type: "string",
      validate: {
        format: "url", // 内置 URL 格式验证
      },
    },
    // 异步自定义验证示例
    username: {
      type: "string",
      validate: {
        required: true,
        asyncCustom: async (value, allValues, context) => {
          // 可以访问数据库进行复杂验证
          const exists = await context.model.where({ username: value }).exists();
          if (exists && context.instanceId !== allValues.id) {
            return "用户名已存在";
          }
          return true;
        },
      },
    },
    // 验证组示例
    password: {
      type: "string",
      validate: {
        required: true,
        min: 8,
        groups: ["create", "update"], // 只在创建和更新时验证
      },
    },
  };
}

// 使用验证组
await User.validate(userData, undefined, ["create"]); // 只验证 "create" 组的字段
```

### MongoModel

MongoDB ODM 模型基类。

**静态方法**：
- `setAdapter(adapter: DatabaseAdapter): void`: 设置数据库适配器
- `init(connectionName?: string): Promise<void>`: 初始化模型（从已初始化的数据库连接中获取适配器并设置，不负责连接数据库）
- `create(data: any): Promise<ModelInstance>`: 创建文档
- `createMany(data: any[]): Promise<ModelInstance[]>`: 批量创建
- `find(conditions: MongoWhereCondition): MongoQueryBuilder`: 查找文档（链式查询）
- `findById(id: any): Promise<ModelInstance | null>`: 通过 ID 查找
- `findOne(conditions: MongoWhereCondition): Promise<ModelInstance | null>`: 查找单条文档
- `findAll(conditions?: MongoWhereCondition): Promise<ModelInstance[]>`: 查找多条文档
- `update(conditions: MongoWhereCondition, data: any): Promise<number>`: 更新文档
- `updateById(id: any, data: any): Promise<boolean>`: 通过 ID 更新
- `updateMany(conditions: MongoWhereCondition, data: any): Promise<number>`: 批量更新
- `delete(conditions: MongoWhereCondition): Promise<number>`: 删除文档
- `deleteById(id: any): Promise<boolean>`: 通过 ID 删除
- `deleteMany(conditions: MongoWhereCondition): Promise<number>`: 批量删除
- `count(conditions?: MongoWhereCondition): Promise<number>`: 统计文档数
- `exists(conditions: MongoWhereCondition): Promise<boolean>`: 检查文档是否存在
- `paginate(page: number, perPage: number, conditions?: MongoWhereCondition): Promise<PaginateResult>`: 分页查询
- `increment(conditions: MongoWhereCondition, field: string, amount?: number): Promise<number>`: 增加字段值
- `decrement(conditions: MongoWhereCondition, field: string, amount?: number): Promise<number>`: 减少字段值
- `incrementMany(conditions: MongoWhereCondition, fieldOrMap: string | Record<string, number>, amount?: number): Promise<number>`: 批量增加字段值
- `decrementMany(conditions: MongoWhereCondition, fieldOrMap: string | Record<string, number>, amount?: number): Promise<number>`: 批量减少字段值
- `upsert(conditions: MongoWhereCondition, data: any): Promise<ModelInstance>`: 更新或插入
- `findOneAndUpdate(conditions: MongoWhereCondition, data: any): Promise<ModelInstance | null>`: 查找并更新
- `findOneAndDelete(conditions: MongoWhereCondition): Promise<ModelInstance | null>`: 查找并删除
- `findOneAndReplace(conditions: MongoWhereCondition, replacement: any): Promise<ModelInstance | null>`: 查找并替换
- `distinct(field: string, conditions?: MongoWhereCondition): Promise<any[]>`: 获取唯一值列表
- `aggregate(pipeline: any[]): Promise<any[]>`: 聚合查询
- `withTrashed(): QueryBuilder`: 包含已删除文档的查询
- `onlyTrashed(): QueryBuilder`: 仅查询已删除文档
- `restore(conditions: MongoWhereCondition): Promise<number>`: 恢复软删除文档
- `restoreById(id: string): Promise<number>`: 通过 ID 恢复软删除文档
- `forceDelete(conditions: MongoWhereCondition): Promise<number>`: 强制删除文档
- `forceDeleteById(id: string): Promise<number>`: 通过 ID 强制删除文档
- `scope(name: string): QueryBuilder`: 作用域查询
- `createIndexes(force?: boolean): Promise<string[]>`: 创建索引（根据模型定义的 indexes 创建）
- `dropIndexes(): Promise<string[]>`: 删除所有索引（除了 _id 索引）
- `getIndexes(): Promise<any[]>`: 获取所有索引信息
- `query(): MongoQueryBuilder`: 获取链式查询构建器

**链式查询构建器方法**（通过 `query()` 返回）：
- `where(condition: MongoWhereCondition | string): MongoQueryBuilder`: 添加查询条件
- `fields(fields: string[]): MongoQueryBuilder`: 选择字段
- `sort(sort: Record<string, 1 | -1 | "asc" | "desc"> | "asc" | "desc"): MongoQueryBuilder`: 排序
- `skip(n: number): MongoQueryBuilder`: 跳过文档
- `limit(n: number): MongoQueryBuilder`: 限制文档数
- `includeTrashed(): MongoQueryBuilder`: 包含已删除文档
- `onlyTrashed(): MongoQueryBuilder`: 仅查询已删除文档
- `findAll(): Promise<ModelInstance[]>`: 执行查询并返回所有结果
- `findOne(): Promise<ModelInstance | null>`: 执行查询并返回第一条结果
- `one(): Promise<ModelInstance | null>`: 执行查询并返回第一条结果（别名）
- `all(): Promise<ModelInstance[]>`: 执行查询并返回所有结果（别名）
- `findById(id: string, fields?: string[]): Promise<ModelInstance | null>`: 通过 ID 查找
- `count(): Promise<number>`: 统计文档数
- `exists(): Promise<boolean>`: 检查文档是否存在
- `update(data: Record<string, any>, returnLatest?: boolean): Promise<number | ModelInstance>`: 更新文档
- `updateById(id: string, data: Record<string, any>, returnLatest?: boolean): Promise<number | ModelInstance>`: 通过 ID 更新
- `updateMany(data: Record<string, any>): Promise<number>`: 批量更新
- `increment(field: string, amount?: number): Promise<number>`: 增加字段值
- `decrement(field: string, amount?: number): Promise<number>`: 减少字段值
- `deleteById(id: string): Promise<number>`: 通过 ID 删除
- `deleteMany(): Promise<number>`: 批量删除
- `restore(options?: { returnIds?: boolean }): Promise<number | { count: number; ids: any[] }>`: 恢复软删除文档
- `restoreById(id: string): Promise<number>`: 通过 ID 恢复软删除文档
- `forceDelete(options?: { returnIds?: boolean }): Promise<number | { count: number; ids: any[] }>`: 强制删除文档
- `forceDeleteById(id: string): Promise<number>`: 通过 ID 强制删除文档
- `distinct(field: string): Promise<any[]>`: 获取唯一值列表
- `aggregate(pipeline: any[]): Promise<any[]>`: 聚合查询
- `findOneAndUpdate(data: Record<string, any>, options?: { returnDocument?: "before" | "after" }): Promise<ModelInstance | null>`: 查找并更新
- `findOneAndDelete(): Promise<ModelInstance | null>`: 查找并删除
- `findOneAndReplace(replacement: Record<string, any>, returnLatest?: boolean): Promise<ModelInstance | null>`: 查找并替换
- `upsert(data: Record<string, any>, returnLatest?: boolean, resurrect?: boolean): Promise<ModelInstance>`: 更新或插入
- `findOrCreate(data: Record<string, any>, resurrect?: boolean): Promise<ModelInstance>`: 查找或创建
- `incrementMany(fieldOrMap: string | Record<string, number>, amount?: number): Promise<number>`: 批量增加字段值
- `decrementMany(fieldOrMap: string | Record<string, number>, amount?: number): Promise<number>`: 批量减少字段值

**实例方法**：
- `save(): Promise<this>`: 保存实例
- `update(data: any): Promise<this>`: 更新实例
- `delete(): Promise<boolean>`: 删除实例
- `reload(): Promise<this>`: 重新加载实例
- `belongsTo(Model: typeof MongoModel, foreignKey?: string, localKey?: string): Promise<ModelInstance | null>`: 属于关系
- `hasOne(Model: typeof MongoModel, foreignKey?: string, localKey?: string): Promise<ModelInstance | null>`: 一对一关系
- `hasMany(Model: typeof MongoModel, foreignKey?: string, localKey?: string): Promise<ModelInstance[]>`: 一对多关系

### SQLQueryBuilder

SQL 查询构建器，提供链式查询 API。

**方法**：
- `select(...fields: string[]): this`: 选择字段
- `from(table: string): this`: 指定表
- `where(condition: string, params?: any[]): this`: 条件查询
- `orWhere(condition: string, params?: any[]): this`: OR 条件查询
- `join(table: string, condition: string, type?: string): this`: 连接查询
- `leftJoin(table: string, condition: string): this`: LEFT JOIN
- `rightJoin(table: string, condition: string): this`: RIGHT JOIN
- `orderBy(column: string, direction?: "ASC" | "DESC"): this`: 排序
- `limit(count: number): this`: 限制记录数
- `offset(count: number): this`: 偏移量
- `insert(table: string, data: Record<string, any>): this`: 插入记录
- `update(table: string, data: Record<string, any>): this`: 更新记录
- `delete(table: string): this`: 删除记录
- `execute<T>(): Promise<T[]>`: 执行查询并返回所有结果
- `executeOne<T>(): Promise<T | null>`: 执行查询并返回第一条结果
- `executeUpdate(): Promise<any>`: 执行更新/插入/删除操作
- `toSQL(): string`: 获取构建的 SQL 语句（用于调试）
- `getParams(): any[]`: 获取参数数组（用于调试）

### MongoQueryBuilder

MongoDB 查询构建器，提供链式查询 API。

**方法**：
- `from(collection: string): this`: 指定集合（与 `collection` 方法相同）
- `collection(name: string): this`: 指定集合
- `find(filter?: any): this`: 查找文档
- `where(conditions: MongoWhereCondition): this`: 条件查询
- `eq(field: string, value: any): this`: 等于条件
- `ne(field: string, value: any): this`: 不等于条件
- `gt(field: string, value: any): this`: 大于条件
- `gte(field: string, value: any): this`: 大于等于条件
- `lt(field: string, value: any): this`: 小于条件
- `lte(field: string, value: any): this`: 小于等于条件
- `in(field: string, values: any[]): this`: IN 条件
- `nin(field: string, values: any[]): this`: NOT IN 条件
- `exists(field: string, value: boolean): this`: 存在条件
- `regex(field: string, pattern: string | RegExp): this`: 正则表达式条件
- `sort(sort: Record<string, 1 | -1>): this`: 排序
- `skip(count: number): this`: 跳过文档
- `limit(count: number): this`: 限制文档数
- `project(fields: Record<string, 0 | 1>): this`: 字段投影
- `query<T>(): Promise<T[]>`: 执行查询并返回数组
- `queryOne<T>(): Promise<T | null>`: 执行查询并返回第一条结果
- `count(): Promise<number>`: 统计文档数
- `execute(): MongoExecutor`: 获取执行器对象（用于 insert、update、delete 等操作）
- `getFilter(): any`: 获取查询过滤器（用于调试）
- `getOptions(): any`: 获取查询选项（用于调试）

**MongoExecutor 方法**（通过 `execute()` 返回）：
- `insert(data: any): Promise<any>`: 插入单个文档
- `insertMany(data: any[]): Promise<any>`: 插入多个文档
- `update(update: any): Promise<any>`: 更新单个文档
- `updateMany(update: any): Promise<any>`: 更新多个文档
- `delete(): Promise<any>`: 删除单个文档
- `deleteMany(): Promise<any>`: 删除多个文档

### MigrationManager

迁移管理器，负责迁移文件的生成、执行和回滚。

**配置选项**：
- `migrationsDir: string`: 迁移文件目录
- `adapter: DatabaseAdapter`: 数据库适配器
- `historyTableName?: string`: 迁移历史表名（SQL 数据库，默认：`migrations`）
- `historyCollectionName?: string`: 迁移历史集合名（MongoDB，默认：`migrations`）

**方法**：
- `create(name: string): Promise<string>`: 创建迁移文件
- `up(count?: number): Promise<void>`: 执行迁移
- `down(count?: number): Promise<void>`: 回滚迁移
- `status(): Promise<MigrationStatus[]>`: 获取迁移状态

---

## ⚡ 性能优化

- **连接池**：自动管理数据库连接池，提高并发性能
- **查询缓存**：ORM 模型支持查询结果缓存，减少数据库查询
- **预处理语句**：所有 SQL 查询使用预处理语句，防止 SQL 注入并提高性能
- **批量操作**：支持批量创建、更新、删除操作
- **索引管理**：支持数据库索引创建和管理
- **异步操作**：所有操作都是异步的，不阻塞主线程

---

## 🧪 测试报告

本项目包含完整的测试套件，所有测试均使用真实数据库进行测试。

**测试统计：**
- ✅ **452 个测试** - 全部通过
- ✅ **15 个测试文件** - 覆盖所有核心功能
- ✅ **100% 通过率** - 无失败测试
- ✅ **真实数据库** - 所有测试使用真实 SQLite、PostgreSQL、MySQL 和 MongoDB 实例
- ✅ **跨运行时** - 测试在 Deno 和 Bun 环境中都通过
- ✅ **测试覆盖率** - 核心功能覆盖率 ~100%，总体覆盖率 ~98%

**详细测试报告请查看：** [TEST_REPORT.md](./TEST_REPORT.md)

### 测试覆盖

**ORM/ODM 功能：**
- ✅ **SQLModel** - 107 个测试（核心 CRUD、查询、生命周期钩子、数据验证、软删除、关联关系）
- ✅ **MongoModel** - 116 个测试（核心 CRUD、查询、生命周期钩子、数据验证、索引管理、关联关系）

**查询构建器：**
- ✅ **SQLQueryBuilder** - 23 个测试（SELECT、JOIN、WHERE、ORDER BY、LIMIT、INSERT、UPDATE、DELETE）
- ✅ **MongoQueryBuilder** - 28 个测试（查询、投影、排序、聚合、更新、删除）

**数据库适配器：**
- ✅ **SQLiteAdapter** - 21 个测试（连接、查询、执行、事务、连接池、健康检查）
- ✅ **PostgreSQLAdapter** - 15 个测试（连接、查询、执行、连接池、健康检查、参数转换）
- ✅ **MySQLAdapter** - 14 个测试（连接、查询、执行、连接池、健康检查）
- ✅ **MongoDBAdapter** - 18 个测试（连接、查询、执行、连接池、健康检查）

**数据库管理：**
- ✅ **DatabaseManager** - 16 个测试（多连接管理、适配器工厂、连接状态）
- ✅ **MigrationManager** - 12 个测试（迁移创建、执行、回滚、状态跟踪）

**数据库初始化与访问：**
- ✅ **init-database** - 22 个测试（数据库初始化、配置加载、连接管理）
- ✅ **access** - 11 个测试（数据库访问辅助函数、自动初始化）

**工具与辅助功能：**
- ✅ **QueryLogger** - 19 个测试（查询日志记录、日志级别过滤、慢查询检测）
- ✅ **BaseAdapter** - 11 个测试（健康检查、查询日志、连接状态）

**事务处理：**
- ✅ **Transaction** - 19 个测试（基本事务、嵌套事务、保存点、多数据库支持）

---

## 📝 备注

- **服务端专用**：数据库连接是服务端功能，客户端不支持
- **统一接口**：使用适配器模式，提供统一的数据库接口，支持多种数据库后端
- **类型安全**：完整的 TypeScript 类型支持
- **依赖**：需要相应的数据库驱动（PostgreSQL、MySQL、SQLite、MongoDB）
- **跨运行时**：支持 Deno 2.6+ 和 Bun 1.3.5，代码在两个环境中都经过测试
- **Bun 原生支持**：SQLiteAdapter 优先使用 Bun 原生 SQLite API，提供更好的性能
- **测试覆盖**：452 个测试用例，核心功能覆盖率 ~100%，总体覆盖率 ~98%
- **真实数据库测试**：所有测试使用真实数据库实例，确保测试的真实性和可靠性

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
