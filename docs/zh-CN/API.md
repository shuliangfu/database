# @dreamer/database API 参考

> 📖 [README](../../README.md) | [中文 README](../../README-zh.md) | [示例](./EXAMPLES.md)

---

## 📚 API 文档

### 数据库初始化

#### initDatabase

初始化数据库连接。

```typescript
initDatabase(config: DatabaseConfig, connectionName?: string): Promise<ConnectionStatus>
```

**参数：**

- `config: DatabaseConfig` - 数据库配置
- `connectionName?: string` - 连接名称（默认为 'default'）

**返回：** `Promise<ConnectionStatus>` - 连接状态信息

**示例：**

```typescript
// SQLite
await initDatabase({
  adapter: "sqlite",
  connection: { filename: ":memory:" },
});

// PostgreSQL
await initDatabase({
  adapter: "postgresql",
  connection: {
    host: "localhost",
    port: 5432,
    database: "mydb",
    username: "user",
    password: "password",
  },
});

// MySQL
await initDatabase({
  adapter: "mysql",
  connection: {
    host: "localhost",
    port: 3306,
    database: "mydb",
    username: "user",
    password: "password",
  },
});

// MongoDB
await initDatabase({
  adapter: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
  // MongoDB 特定配置选项（可选）
  mongoOptions: {
    // 服务器选择超时时间（毫秒），默认：30000
    serverSelectionTimeoutMS: 30000,
    // 连接超时时间（毫秒），默认：5000
    connectTimeoutMS: 5000,
    // Socket 超时时间（毫秒），默认：5000
    socketTimeoutMS: 5000,
    // 副本集名称（如果 MongoDB 开启了副本集，必须设置）
    replicaSet: "rs0",
    // 是否使用直接连接模式（单节点副本集建议设置为 true）
    directConnection: true,
    // 连接池配置
    maxPoolSize: 10,
    minPoolSize: 2,
  },
});
```

#### 数据库配置参数与环境变量

各数据库支持通过环境变量覆盖连接配置，便于测试与部署：

**MySQL/MariaDB**：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MYSQL_HOST` | `127.0.0.1` | 主机地址 |
| `MYSQL_PORT` | `3306` | 端口 |
| `MYSQL_DATABASE` | `test` | 数据库名 |
| `MYSQL_USER` | `root` | 用户名 |
| `MYSQL_PASSWORD` | `8866231` | 密码 |

**PostgreSQL**：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `POSTGRES_HOST` | `localhost` | 主机地址 |
| `POSTGRES_PORT` | `5432` | 端口 |
| `POSTGRES_DATABASE` | `postgres` | 数据库名 |
| `POSTGRES_USER` | `root` | 用户名 |
| `POSTGRES_PASSWORD` | `8866231` | 密码 |

**MongoDB**：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MONGODB_HOST` | `localhost` | 主机地址 |
| `MONGODB_PORT` | `27017` | 端口 |
| `MONGODB_DATABASE` | `test` | 数据库名 |
| `MONGODB_USER` | `root` | 用户名（空则无认证） |
| `MONGODB_PASSWORD` | `8866231` | 密码 |
| `MONGODB_AUTH_SOURCE` | `admin` | 认证库 |
| `MONGODB_REPLICA_SET` | `rs0` | 副本集名称 |
| `MONGODB_DIRECT_CONNECTION` | `true` | 是否直接连接 |

**配置覆盖**：`initDatabase` 传入的 `config` 优先于环境变量。可选覆盖项：
- **MySQL/PostgreSQL**：`pool` 合并连接池配置，`database` 指定数据库名
- **MongoDB**：`mongoOptions` 合并 MongoDB 选项（如 `maxPoolSize`），`database` 指定数据库名

#### getDatabase

同步获取数据库连接（如果未初始化会抛出错误）。

```typescript
getDatabase(connectionName?: string): DatabaseAdapter
```

#### getDatabaseAsync

异步获取数据库连接（支持自动初始化）。

```typescript
getDatabaseAsync(connectionName?: string): Promise<DatabaseAdapter>
```

#### closeDatabase

关闭所有数据库连接。

```typescript
closeDatabase(): Promise<void>
```

---

## 📖 SQLModel 详细 API

SQLModel 是关系型数据库（PostgreSQL、MySQL、SQLite）的 ORM
基类，提供完整的数据库操作功能。

### 模型定义

```typescript
class User extends SQLModel {
  // 必须定义表名
  static override tableName = "users";

  // 主键字段名（默认为 "id"）
  static override primaryKey = "id";

  // 字段定义和验证规则
  static override schema = {
    name: { type: "string", validate: { required: true } },
    email: { type: "string", validate: { required: true, unique: true } },
    age: { type: "number", validate: { min: 0, max: 150 } },
  };

  // 软删除支持（可选）
  static override softDelete = true;
  static override deletedAtField = "deleted_at";

  // 时间戳字段（可选）
  static override timestamps = true;
  static override createdAtField = "created_at";
  static override updatedAtField = "updated_at";
}
```

### 数据验证规则

数据库模型支持丰富的数据验证规则，确保数据完整性和正确性。

#### 基础验证

- **`required: boolean`** - 必填字段
- **`type: FieldType`** - 字段类型（string、number、boolean、date 等）
- **`min: number`** - 最小值（数字）或最小长度（字符串）
- **`max: number`** - 最大值（数字）或最大长度（字符串）
- **`length: number`** - 固定长度（字符串）
- **`pattern: RegExp | string`** - 正则表达式验证
- **`enum: any[]`** - 枚举值验证
- **`custom: (value: any) => boolean | string`** - 自定义验证函数

#### 跨字段验证

- **`equals: string`** - 与另一个字段值相等
- **`notEquals: string`** - 与另一个字段值不相等
- **`compare: (value, allValues) => boolean | string`** - 自定义字段比较函数
- **`compareValue`** - 跨表/跨字段值比较验证（支持跨表、多种操作符）

#### 数据库查询验证（异步）

- **`unique: boolean | object`** - 在数据表中唯一
- **`exists: boolean | object`** - 在数据表中存在
- **`notExists: boolean | object`** - 在数据表中不存在

#### 高级验证功能

- **`when`** - 条件验证（根据其他字段值决定是否验证）
- **`requiredWhen`** - 条件必填（根据条件决定是否必填）
- **`asyncCustom`** - 异步自定义验证（可访问数据库）
- **`groups: string[]`** - 验证组（只在指定组中验证）
- **`array`** - 数组验证（验证数组元素）
- **`format`** - 内置格式验证器（email、url、uuid、date 等）

#### 数值验证增强

- **`integer: boolean`** - 整数验证
- **`positive: boolean`** - 正数验证
- **`negative: boolean`** - 负数验证
- **`multipleOf: number`** - 倍数验证
- **`range: [number, number]`** - 范围验证

#### 字符串验证增强

- **`alphanumeric: boolean`** - 字母数字验证
- **`numeric: boolean`** - 数字字符串验证
- **`alpha: boolean`** - 字母验证
- **`lowercase: boolean`** - 小写验证
- **`uppercase: boolean`** - 大写验证
- **`startsWith: string`** - 前缀验证
- **`endsWith: string`** - 后缀验证
- **`contains: string`** - 包含验证
- **`trim: boolean`** - 自动去除首尾空格
- **`toLowerCase: boolean`** - 自动转换为小写
- **`toUpperCase: boolean`** - 自动转换为大写

#### 日期时间验证增强

- **`before: string | Date`** - 早于验证
- **`after: string | Date`** - 晚于验证
- **`beforeTime: string`** - 早于时间验证
- **`afterTime: string`** - 晚于时间验证
- **`timezone: string`** - 时区验证

#### 密码验证

- **`passwordStrength`** - 密码强度验证（最小长度、大小写、数字、符号要求）

#### 验证示例

```typescript
class User extends SQLModel {
  static override tableName = "users";
  static override schema = {
    email: {
      type: "string",
      validate: {
        required: true,
        format: "email",
        unique: true,
      },
    },
    password: {
      type: "string",
      validate: {
        required: true,
        min: 8,
        passwordStrength: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
        },
      },
    },
    age: {
      type: "number",
      validate: {
        integer: true,
        range: [0, 150],
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
        after: "startDate",
      },
    },
    categoryId: {
      type: "number",
      validate: {
        required: true,
        exists: true, // 必须在 categories 表中存在
      },
    },
  };
}
```

> 💡 **提示**：数据验证规则同时适用于 `SQLModel` 和
> `MongoModel`，两者使用完全相同的验证规则。

### 静态查询方法

#### find

通过 ID 或条件查找记录。

```typescript
// 通过 ID 查找
const user = await User.find(1);

// 通过条件查找
const user = await User.find({ email: "alice@example.com" });
```

#### findAll

查找多条记录。

```typescript
// 查找所有记录
const users = await User.findAll();

// 条件查询
const users = await User.findAll({ age: { $gt: 18 } });

// 排序
const users = await User.findAll({}, { sort: { age: "desc" } });

// 分页
const users = await User.findAll({}, { limit: 10, offset: 0 });
```

#### findOne

查找单条记录。

```typescript
const user = await User.findOne({ email: "alice@example.com" });
```

#### findById

通过 ID 查找记录。

```typescript
const user = await User.findById(1);
```

#### count

统计记录数。

```typescript
// 统计所有记录
const total = await User.count();

// 条件统计
const count = await User.count({ age: { $gt: 18 } });
```

#### exists

检查记录是否存在。

```typescript
const exists = await User.exists({ email: "alice@example.com" });
```

#### paginate

分页查询。

```typescript
const result = await User.paginate(1, 10, { age: { $gt: 18 } });
// 返回: { data: User[], total: number, page: number, pageSize: number, totalPages: number }
```

#### distinct

获取字段的唯一值列表。

```typescript
const emails = await User.distinct("email");
```

### 静态操作方法

#### create

创建新记录。

```typescript
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
});
```

#### createMany

批量创建记录。

```typescript
const users = await User.createMany([
  { name: "Alice", email: "alice@example.com", age: 25 },
  { name: "Bob", email: "bob@example.com", age: 30 },
]);
```

#### update

更新记录。

```typescript
// 通过条件更新
await User.update({ age: { $lt: 18 } }, { status: "minor" });

// 通过 ID 更新
await User.update(1, { age: 26 });

// 支持 returnLatest 选项返回更新后的记录
const updated = await User.update(1, { age: 26 }, { returnLatest: true });
```

#### updateById

通过 ID 更新记录。

```typescript
await User.updateById(1, { age: 26 });
```

#### updateMany

批量更新记录。

```typescript
await User.updateMany({ status: "active" }, { lastLogin: new Date() });
```

#### delete

删除记录（支持软删除）。

```typescript
// 通过条件删除
await User.delete({ age: { $lt: 0 } });

// 通过 ID 删除
await User.delete(1);
```

#### deleteById

通过 ID 删除记录。

```typescript
await User.deleteById(1);
```

#### deleteMany

批量删除记录。

```typescript
// 返回删除的记录数
const count = await User.deleteMany({ status: "inactive" });

// 支持 returnIds 选项返回删除的记录 ID
const result = await User.deleteMany({ status: "inactive" }, {
  returnIds: true,
});
// 返回: { count: number, ids: any[] }
```

#### increment

增加字段值。

```typescript
// 单个字段
await User.increment(1, "age", 1);

// 对象格式（批量自增）
await User.increment(1, { age: 1, score: 10 });

// 支持 returnLatest 选项返回更新后的记录
const updated = await User.increment(1, "age", 5, true);
```

#### decrement

减少字段值。

```typescript
// 单个字段
await User.decrement(1, "age", 1);

// 对象格式（批量自减）
await User.decrement(1, { age: 1, score: 10 });

// 支持 returnLatest 选项返回更新后的记录
const updated = await User.decrement(1, "age", 5, true);
```

#### incrementMany

批量自增多个字段。

```typescript
await User.incrementMany({ status: "active" }, { views: 1, likes: 1 });
```

#### decrementMany

批量自减多个字段。

```typescript
await User.decrementMany({ status: "active" }, { views: 1, likes: 1 });
```

#### upsert

插入或更新记录。

```typescript
// 如果记录不存在则创建，存在则更新
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
);

// 支持 returnLatest 选项
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  { returnLatest: true },
);

// 支持 resurrect 选项（恢复软删除的记录）
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  { returnLatest: true, resurrect: true },
);
```

#### findOrCreate

查找或创建记录。

```typescript
// 如果记录存在则返回，不存在则创建
const user = await User.findOrCreate(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
);

// 支持 resurrect 选项（恢复软删除的记录）
const user = await User.findOrCreate(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  true, // resurrect
);
```

#### findOneAndUpdate

查找并更新记录。

```typescript
const user = await User.findOneAndUpdate(
  { email: "alice@example.com" },
  { age: 26 },
);
```

#### findOneAndDelete

查找并删除记录。

```typescript
const user = await User.findOneAndDelete({ email: "alice@example.com" });
```

#### findOneAndReplace

查找并替换记录。

```typescript
// 返回替换后的记录
const user = await User.findOneAndReplace(
  { email: "alice@example.com" },
  { name: "Alice Updated", age: 26 },
  { returnLatest: true },
);
```

#### truncate

清空表。

```typescript
await User.truncate();
```

### 软删除相关方法

#### withTrashed

包含已删除记录的查询。

```typescript
const users = await User.withTrashed().findAll();
```

#### onlyTrashed

仅查询已删除记录。

```typescript
const deletedUsers = await User.onlyTrashed().findAll();
```

#### restore

恢复软删除记录。

```typescript
// 通过条件恢复
await User.restore({ status: "inactive" });

// 支持 returnIds 选项
const result = await User.restore({ status: "inactive" }, { returnIds: true });
```

#### restoreById

通过 ID 恢复软删除记录。

```typescript
await User.restoreById(1);
```

#### forceDelete

强制删除记录（物理删除）。

```typescript
// 通过条件强制删除
await User.forceDelete({ status: "deleted" });

// 支持 returnIds 选项
const result = await User.forceDelete({ status: "deleted" }, {
  returnIds: true,
});
```

#### forceDeleteById

通过 ID 强制删除记录。

```typescript
await User.forceDeleteById(1);
```

### 链式查询构建器

通过 `query()` 和 `find()`
方法获取链式查询构建器。两者都支持链式调用，但在使用方式和功能上有所不同。

#### query() 与 find() 功能对比

| 功能                  | `query()` | `find()` | 说明                                                                                            |
| --------------------- | --------- | -------- | ----------------------------------------------------------------------------------------------- |
| **查询条件方法**      |           |          |                                                                                                 |
| `where()`             | ✅        | ❌       | 设置查询条件（重置之前的所有条件）。`find()` 不支持，因为 `find()` 已有初始条件，不应重置       |
| `orWhere()`           | ✅        | ✅       | 添加 OR 查询条件                                                                                |
| `andWhere()`          | ✅        | ✅       | 添加 AND 查询条件                                                                               |
| `like()`              | ✅        | ❌       | 设置 LIKE 查询条件（重置之前的所有条件）。`find()` 不支持，因为 `find()` 已有初始条件，不应重置 |
| `orLike()`            | ✅        | ✅       | 添加 OR LIKE 查询条件                                                                           |
| `andLike()`           | ✅        | ✅       | 添加 AND LIKE 查询条件                                                                          |
| **查询方法**          |           |          |                                                                                                 |
| `findAll()`           | ✅        | ✅       | 查找多条记录                                                                                    |
| `findOne()`           | ✅        | ✅       | 查找单条记录                                                                                    |
| `one()`               | ✅        | ✅       | 查找单条记录（别名）                                                                            |
| `all()`               | ✅        | ✅       | 查找多条记录（别名）                                                                            |
| `findById()`          | ✅        | ❌       | 通过 ID 查找（find 本身就需要 ID）                                                              |
| **聚合方法**          |           |          |                                                                                                 |
| `count()`             | ✅        | ✅       | 统计记录数                                                                                      |
| `exists()`            | ✅        | ✅       | 检查记录是否存在                                                                                |
| `distinct()`          | ✅        | ✅       | 获取字段唯一值列表                                                                              |
| `paginate()`          | ✅        | ✅       | 分页查询                                                                                        |
| `aggregate()`         | ✅        | ✅       | 聚合查询（仅 MongoDB）                                                                          |
| **操作方法**          |           |          |                                                                                                 |
| `update()`            | ✅        | ❌       | 更新记录（find 专注于查询，操作请使用 query）                                                   |
| `updateById()`        | ✅        | ❌       | 通过 ID 更新（find 专注于查询，操作请使用 query）                                               |
| `updateMany()`        | ✅        | ❌       | 批量更新（find 专注于查询，操作请使用 query）                                                   |
| `deleteById()`        | ✅        | ❌       | 通过 ID 删除（find 专注于查询，操作请使用 query）                                               |
| `deleteMany()`        | ✅        | ❌       | 批量删除（find 专注于查询，操作请使用 query）                                                   |
| `increment()`         | ✅        | ❌       | 自增字段（find 专注于查询，操作请使用 query）                                                   |
| `decrement()`         | ✅        | ❌       | 自减字段（find 专注于查询，操作请使用 query）                                                   |
| `incrementMany()`     | ✅        | ❌       | 批量自增（find 专注于查询，操作请使用 query）                                                   |
| `decrementMany()`     | ✅        | ❌       | 批量自减（find 专注于查询，操作请使用 query）                                                   |
| `restore()`           | ✅        | ❌       | 恢复软删除记录（find 专注于查询，操作请使用 query）                                             |
| `restoreById()`       | ✅        | ❌       | 通过 ID 恢复（find 专注于查询，操作请使用 query）                                               |
| `forceDelete()`       | ✅        | ❌       | 强制删除（find 专注于查询，操作请使用 query）                                                   |
| `forceDeleteById()`   | ✅        | ❌       | 通过 ID 强制删除（find 专注于查询，操作请使用 query）                                           |
| `upsert()`            | ✅        | ❌       | 插入或更新（find 专注于查询，操作请使用 query）                                                 |
| `findOrCreate()`      | ✅        | ❌       | 查找或创建（find 专注于查询，操作请使用 query）                                                 |
| `findOneAndUpdate()`  | ✅        | ❌       | 查找并更新（find 专注于查询，操作请使用 query）                                                 |
| `findOneAndDelete()`  | ✅        | ❌       | 查找并删除（find 专注于查询，操作请使用 query）                                                 |
| `findOneAndReplace()` | ✅        | ❌       | 查找并替换（find 专注于查询，操作请使用 query）                                                 |
| **其他方法**          |           |          |                                                                                                 |
| `sort()`              | ✅        | ✅       | 排序                                                                                            |
| `limit()`             | ✅        | ✅       | 限制数量                                                                                        |
| `skip()`              | ✅        | ✅       | 跳过数量                                                                                        |
| `fields()`            | ✅        | ✅       | 选择字段                                                                                        |
| `includeTrashed()`    | ✅        | ✅       | 包含已删除记录                                                                                  |
| `onlyTrashed()`       | ✅        | ✅       | 仅查询已删除记录                                                                                |
| `asArray()`           | ✅        | ✅       | 返回纯 JSON 对象数组                                                                            |

**使用建议：**

- 使用 `query()`：从空查询开始构建复杂查询，需要执行更新/删除等操作
- 使用 `find()`：已有初始条件（ID 或条件对象），专注于查询操作

#### 查询方法

```typescript
// findAll - 查找所有记录
const users = await User.query()
  .where("age", ">", 18)
  .sort("created_at", "desc")
  .findAll();

// findOne - 查找单条记录
const user = await User.query()
  .where("email", "alice@example.com")
  .findOne();

// one / all - 别名方法
const user = await User.query().where("id", 1).one();
const users = await User.query().where("age", ">", 18).all();

// findById - 通过 ID 查找
const user = await User.query().findById(1);
const user = await User.query().findById(1, ["name", "email"]); // 指定字段

// count - 统计记录数
const count = await User.query().where("age", ">", 18).count();

// exists - 检查记录是否存在
const exists = await User.query().where("email", "alice@example.com").exists();

// distinct - 获取唯一值列表
const emails = await User.query().distinct("email");

// paginate - 分页查询
const result = await User.query()
  .where("age", ">", 18)
  .paginate(1, 10);
```

#### 操作方法

```typescript
// update - 更新记录
await User.query()
  .where("age", ">", 18)
  .update({ status: "adult" });

// update - 支持 returnLatest 选项
const updated = await User.query()
  .where("id", 1)
  .update({ age: 26 }, true); // returnLatest

// updateById - 通过 ID 更新
await User.query().updateById(1, { age: 26 });

// updateMany - 批量更新
await User.query()
  .where("status", "active")
  .updateMany({ lastLogin: new Date() });

// increment - 自增（支持对象格式）
await User.query()
  .where("id", 1)
  .increment("age", 1);

await User.query()
  .where("id", 1)
  .increment({ age: 1, score: 10 }, true); // returnLatest

// decrement - 自减（支持对象格式）
await User.query()
  .where("id", 1)
  .decrement("age", 1);

await User.query()
  .where("id", 1)
  .decrement({ age: 1, score: 10 }, true); // returnLatest

// incrementMany - 批量自增
await User.query()
  .where("status", "active")
  .incrementMany({ views: 1, likes: 1 });

// decrementMany - 批量自减
await User.query()
  .where("status", "active")
  .decrementMany({ views: 1, likes: 1 });

// deleteById - 通过 ID 删除
await User.query().deleteById(1);

// deleteMany - 批量删除
await User.query()
  .where("status", "inactive")
  .deleteMany();

// deleteMany - 支持 returnIds 选项
const result = await User.query()
  .where("status", "inactive")
  .deleteMany({ returnIds: true });

// upsert - 插入或更新
const user = await User.query()
  .where("email", "alice@example.com")
  .upsert({ name: "Alice", age: 25 }, true, true); // returnLatest, resurrect

// findOrCreate - 查找或创建
const user = await User.query()
  .where("email", "alice@example.com")
  .findOrCreate({ name: "Alice", age: 25 }, true); // resurrect

// findOneAndUpdate - 查找并更新
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndUpdate({ age: 26 });

// findOneAndDelete - 查找并删除
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndDelete();

// findOneAndReplace - 查找并替换
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndReplace({ name: "Alice Updated", age: 26 }, true); // returnLatest

// restore - 恢复软删除记录
await User.query()
  .where("status", "inactive")
  .restore();

// restore - 支持 returnIds 选项
const result = await User.query()
  .where("status", "inactive")
  .restore({ returnIds: true });

// restoreById - 通过 ID 恢复
await User.query().restoreById(1);

// forceDelete - 强制删除
await User.query()
  .where("status", "deleted")
  .forceDelete();

// forceDelete - 支持 returnIds 选项
const result = await User.query()
  .where("status", "deleted")
  .forceDelete({ returnIds: true });

// forceDeleteById - 通过 ID 强制删除
await User.query().forceDeleteById(1);
```

#### 链式条件构建

```typescript
// where - 设置查询条件（重置所有之前的条件）
const users = await User.query()
  .where({ status: "active" })
  .findAll();

// orWhere - 添加 OR 查询条件
const users = await User.query()
  .where({ name: "Alice" })
  .orWhere({ name: "Bob" })
  .findAll();

// andWhere - 添加 AND 查询条件
const users = await User.query()
  .where({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .findAll();

// like - 设置 LIKE 查询条件（模糊查询，大小写不敏感）
const users = await User.query()
  .like({ name: "Alice" })
  .findAll();

// orLike - 添加 OR LIKE 查询条件
const users = await User.query()
  .like({ name: "Alice" })
  .orLike({ name: "Bob" })
  .findAll();

// andLike - 添加 AND LIKE 查询条件
const users = await User.query()
  .where({ age: { $gte: 18 } })
  .andLike({ email: "example" })
  .findAll();

// find() 方法支持追加查询条件（orWhere, andWhere, orLike, andLike）
// 注意：find() 不支持 where() 和 like()，因为已有初始条件，不应重置
const users = await User.find({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .orWhere({ status: "inactive" })
  .findAll();

// find() 方法支持模糊查询（使用 orLike 和 andLike）
const users = await User.find({ name: { $like: "%Alice%" } })
  .orLike({ name: "Bob" })
  .findAll();

// fields - 选择字段
const users = await User.query()
  .fields(["name", "email"])
  .findAll();

// sort - 排序
const users = await User.query()
  .sort("created_at", "desc")
  .findAll();

// 多字段排序
const users = await User.query()
  .sort({ age: "desc", name: "asc" })
  .findAll();

// limit / skip - 分页
const users = await User.query()
  .limit(10)
  .skip(20)
  .findAll();

// includeTrashed - 包含已删除记录
const users = await User.query()
  .includeTrashed()
  .findAll();

// onlyTrashed - 仅查询已删除记录
const users = await User.query()
  .onlyTrashed()
  .findAll();

// scope - 作用域查询
const users = await User.scope("active").findAll();
```

#### asArray() - 返回纯 JSON 对象数组

`asArray()` 方法可以将查询结果转换为纯 JSON
对象数组，而不是模型实例。这对于需要纯数据格式的场景非常有用，比如 API
响应、数据序列化等。

**特点：**

- 返回纯 JSON 对象数组（`Record<string, any>[]`），不是模型实例
- 支持所有链式调用方法（sort、limit、skip、fields 等）
- 支持聚合方法（count、exists、distinct、paginate）
- 返回的对象可以安全地进行 JSON 序列化
- 返回的对象没有模型方法（如 `save`、`update` 等）

**使用方式：**

```typescript
// 通过 find().asArray() 返回纯 JSON 对象数组
const users = await User.find({ status: "active" })
  .asArray()
  .findAll();

// 通过 find().asArray() 返回纯 JSON 对象或 null
const user = await User.find({ status: "active" })
  .asArray()
  .findOne();

// 通过 query().where().asArray() 返回纯 JSON 对象数组
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .findAll();

// 支持链式调用 sort、limit、skip 等
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .sort({ age: "desc" })
  .limit(10)
  .skip(20)
  .findAll();

// 支持 fields 字段选择
const user = await User.query()
  .where({ status: "active" })
  .asArray()
  .fields(["name", "age"])
  .findOne();

// 支持聚合方法
const count = await User.query()
  .where({ status: "active" })
  .asArray()
  .count();

const exists = await User.query()
  .where({ status: "active" })
  .asArray()
  .exists();

const ages = await User.query()
  .where({ status: "active" })
  .asArray()
  .distinct("age");

// 支持分页
const result = await User.query()
  .where({ status: "active" })
  .asArray()
  .paginate(1, 10);

// 支持别名方法 all() 和 one()
const users = await User.find({ status: "active" })
  .asArray()
  .all();

const user = await User.find({ status: "active" })
  .asArray()
  .one();

// 复杂链式调用
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .sort({ age: "desc" })
  .skip(5)
  .limit(10)
  .findAll();

// 验证返回的是纯 JSON 对象
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .findAll();

// 可以安全地进行 JSON 序列化
const json = JSON.stringify(users);
const parsed = JSON.parse(json);

// 返回的对象没有模型方法
const user = await User.find({ status: "active" })
  .asArray()
  .findOne();

console.log(typeof user?.save); // "undefined"
console.log(user?.constructor.name); // "Object" 而不是 "User"
```

**注意事项：**

- `asArray()` 返回的是纯 JSON 对象，不能调用模型方法（如
  `save`、`update`、`delete` 等）
- 如果需要模型实例的功能，请使用普通的 `find()` 或 `query()` 方法
- 返回的对象使用浅拷贝（`{ ...row }`），性能优于 `JSON.parse(JSON.stringify())`

### 实例方法

#### save

保存实例（新建或更新）。

```typescript
const user = new User();
user.name = "Alice";
user.email = "alice@example.com";
await user.save(); // 新建

user.age = 26;
await user.save(); // 更新
```

#### update

更新实例。

```typescript
await user.update({ age: 26 });
```

#### delete

删除实例。

```typescript
await user.delete();
```

### 关联查询

#### belongsTo

多对一关系（当前模型属于另一个模型）。

```typescript
// 定义关联
const author = await post.belongsTo(User, "user_id", "id");

// 支持字段选择
const author = await post.belongsTo(User, "user_id", "id", ["name", "email"]);

// 支持 includeTrashed 选项
const author = await post.belongsTo(User, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

#### hasOne

一对一关系（当前模型拥有一个关联模型）。

```typescript
// 定义关联
const profile = await user.hasOne(Profile, "user_id", "id");

// 支持字段选择
const profile = await user.hasOne(Profile, "user_id", "id", ["bio", "avatar"]);

// 支持 includeTrashed 选项
const profile = await user.hasOne(Profile, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

#### hasMany

一对多关系（当前模型拥有多个关联模型）。

```typescript
// 定义关联
const posts = await user.hasMany(Post, "user_id", "id");

// 支持字段选择
const posts = await user.hasMany(Post, "user_id", "id", ["title", "content"]);

// 支持 options 参数（排序、分页等）
const posts = await user.hasMany(Post, "user_id", "id", undefined, {
  sort: { created_at: "desc" },
  limit: 10,
});

// 支持 includeTrashed 选项
const posts = await user.hasMany(
  Post,
  "user_id",
  "id",
  undefined,
  undefined,
  true,
);

// 支持 onlyTrashed 选项
const deletedPosts = await user.hasMany(
  Post,
  "user_id",
  "id",
  undefined,
  undefined,
  false,
  true,
);
```

### 生命周期钩子

```typescript
class User extends SQLModel {
  static override tableName = "users";

  // 创建前钩子
  static override beforeCreate(data: any) {
    data.created_at = new Date();
    return data;
  }

  // 创建后钩子
  static override afterCreate(instance: any) {
    console.log("User created:", instance.id);
  }

  // 更新前钩子
  static override beforeUpdate(data: any, conditions: any) {
    data.updated_at = new Date();
    return data;
  }

  // 更新后钩子
  static override afterUpdate(instance: any) {
    console.log("User updated:", instance.id);
  }

  // 保存前钩子（创建和更新都会调用）
  static override beforeSave(data: any) {
    // 处理逻辑
    return data;
  }

  // 保存后钩子
  static override afterSave(instance: any) {
    console.log("User saved:", instance.id);
  }

  // 删除前钩子
  static override beforeDelete(conditions: any) {
    console.log("Deleting user:", conditions);
  }

  // 删除后钩子
  static override afterDelete(instance: any) {
    console.log("User deleted:", instance.id);
  }

  // 验证前钩子
  static override beforeValidate(data: any) {
    // 预处理数据
    return data;
  }

  // 验证后钩子
  static override afterValidate(data: any) {
    // 后处理数据
    return data;
  }
}
```

---

## 📖 MongoModel 详细 API

MongoModel 是 MongoDB 的 ODM 基类，提供完整的 MongoDB 操作功能。

### 模型定义

```typescript
class Article extends MongoModel {
  // 必须定义集合名
  static override collectionName = "articles";

  // 主键字段名（默认为 "_id"）
  static override primaryKey = "_id";

  // 字段定义和验证规则
  static override schema = {
    title: { type: "string", validate: { required: true, max: 200 } },
    content: { type: "string", validate: { required: true } },
    status: {
      type: "string",
      validate: { enum: ["draft", "published", "archived"] },
    },
  };

  // 软删除支持（可选）
  static override softDelete = true;
  static override deletedAtField = "deleted_at";

  // 时间戳字段（可选）
  static override timestamps = true;
  static override createdAtField = "created_at";
  static override updatedAtField = "updated_at";

  // 索引定义（可选）
  static override indexes = [
    { fields: { title: 1 }, options: { unique: true } },
    { fields: { status: 1, created_at: -1 } },
  ];
}
```

### 数据验证规则

MongoModel 的数据验证规则与 SQLModel 完全一致，详见
[SQLModel 文档](#数据验证规则)。

### 静态查询方法

MongoModel 的静态查询方法与 SQLModel 完全一致，详见
[SQLModel 文档](#静态查询方法)。

### 静态操作方法

MongoModel 的静态操作方法与 SQLModel 完全一致，详见
[SQLModel 文档](#静态操作方法)。

### 链式查询构建器

MongoModel 的链式查询构建器方法与 SQLModel 完全一致，详见
[SQLModel 文档](#链式查询构建器)。

### MongoModel 独有方法

#### createIndexes

创建索引（根据模型定义的 indexes 创建）。

```typescript
// 创建所有定义的索引
const indexNames = await Article.createIndexes();

// 强制重新创建索引（删除后重建）
const indexNames = await Article.createIndexes(true);
```

#### dropIndexes

删除所有索引（除了 _id 索引）。

```typescript
const droppedIndexes = await Article.dropIndexes();
```

#### getIndexes

获取所有索引信息。

```typescript
const indexes = await Article.getIndexes();
```

#### aggregate

聚合查询（MongoDB 特有功能）。

```typescript
// 静态方法
const result = await Article.aggregate([
  { $match: { status: "published" } },
  { $group: { _id: "$author", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

// 链式查询
const result = await Article.query()
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
  ]);
```

#### transaction

MongoDB 事务（MongoModel 特有）。

```typescript
await Article.transaction(async (session) => {
  const article1 = await Article.create({ title: "Article 1" }, { session });
  const article2 = await Article.create({ title: "Article 2" }, { session });
  // 如果任何操作失败，事务会自动回滚
});
```

### 实例方法

MongoModel 的实例方法与 SQLModel 完全一致，详见 [SQLModel 文档](#实例方法)。

### 关联查询

MongoModel 的关联查询方法与 SQLModel 完全一致，详见 [SQLModel 文档](#关联查询)。

### 生命周期钩子

MongoModel 的生命周期钩子与 SQLModel 完全一致，详见
[SQLModel 文档](#生命周期钩子)。

---

## 🔧 查询构建器详细文档

### SQLQueryBuilder

SQL 查询构建器，用于构建复杂的 SQL 查询。

#### 基本用法

```typescript
import { getDatabase, SQLQueryBuilder } from "jsr:@dreamer/database";

const db = getDatabase();
const builder = new SQLQueryBuilder(db);

// SELECT 查询
const users = await builder
  .select("id", "name", "email")
  .from("users")
  .where("age > ?", [18])
  .orderBy("created_at", "DESC")
  .limit(10)
  .execute();

// INSERT 操作
await builder
  .insert("users")
  .values({ name: "Alice", email: "alice@example.com", age: 25 })
  .executeUpdate();

// UPDATE 操作
await builder
  .update("users")
  .set({ age: 26 })
  .where("id = ?", [1])
  .executeUpdate();

// DELETE 操作
await builder
  .delete("users")
  .where("id = ?", [1])
  .executeUpdate();
```

#### JOIN 查询

```typescript
// INNER JOIN
const results = await builder
  .select("users.name", "posts.title")
  .from("users")
  .join("posts", "users.id = posts.user_id")
  .execute();

// LEFT JOIN
const results = await builder
  .select("users.name", "posts.title")
  .from("users")
  .leftJoin("posts", "users.id = posts.user_id")
  .execute();

// RIGHT JOIN
const results = await builder
  .select("users.name", "posts.title")
  .from("users")
  .rightJoin("posts", "users.id = posts.user_id")
  .execute();
```

#### 复杂条件查询

```typescript
// 多个 WHERE 条件（AND）
const users = await builder
  .select("*")
  .from("users")
  .where("age > ?", [18])
  .where("status = ?", ["active"])
  .execute();

// OR 条件
const users = await builder
  .select("*")
  .from("users")
  .where("age > ?", [18])
  .orWhere("status = ?", ["active"])
  .execute();
```

### MongoQueryBuilder

MongoDB 查询构建器，用于构建复杂的 MongoDB 查询。

#### 基本用法

```typescript
import { getDatabase, MongoQueryBuilder } from "jsr:@dreamer/database";

const db = getDatabase();
const builder = new MongoQueryBuilder(db);

// 查询文档
const articles = await builder
  .collection("articles")
  .find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(10)
  .query();

// 插入文档
await builder
  .collection("articles")
  .execute()
  .insert({ title: "Hello", content: "World", status: "published" });

// 更新文档
await builder
  .collection("articles")
  .find({ status: "draft" })
  .execute()
  .updateMany({ $set: { status: "published" } });

// 删除文档
await builder
  .collection("articles")
  .find({ status: "archived" })
  .execute()
  .deleteMany();
```

#### 条件查询

```typescript
// 等于
const articles = await builder
  .collection("articles")
  .eq("status", "published")
  .query();

// 不等于
const articles = await builder
  .collection("articles")
  .ne("status", "draft")
  .query();

// 大于/小于
const articles = await builder
  .collection("articles")
  .gt("views", 100)
  .lt("views", 1000)
  .query();

// IN / NOT IN
const articles = await builder
  .collection("articles")
  .in("status", ["published", "archived"])
  .query();

// 正则表达式
const articles = await builder
  .collection("articles")
  .regex("title", /hello/i)
  .query();
```

#### 聚合查询

```typescript
const result = await builder
  .collection("articles")
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
```

---

## 🔄 事务处理

> 📖 **示例**：参见 [EXAMPLES.md#transaction-handling](./EXAMPLES.md#transaction-handling)，包含基本事务、嵌套事务（保存点）、MongoDB 事务。

---

## 🔗 关联查询详细说明

> 📖 **示例**：参见 [EXAMPLES.md#association-query-details](./EXAMPLES.md#association-query-details)，包含 belongsTo、hasOne、hasMany。

---

## 📦 迁移管理

> 📖 **示例**：参见 [EXAMPLES.md#migration-management](./EXAMPLES.md#migration-management)，包含创建、执行、回滚、查看状态。

---

## 🔄 SQLModel 与 MongoModel 统一接口

`SQLModel` 和 `MongoModel` 提供统一的接口，便于在不同数据库之间切换使用。

### 统一接口对比

#### 静态查询方法

| 方法名              | SQLModel | MongoModel | 统一状态                          |
| ------------------- | -------- | ---------- | --------------------------------- |
| `find`              | ✅       | ✅         | ✅ 已统一                         |
| `findAll`           | ✅       | ✅         | ✅ 已统一                         |
| `findOne`           | ✅       | ✅         | ✅ 已统一                         |
| `findById`          | ✅       | ✅         | ✅ 已统一                         |
| `count`             | ✅       | ✅         | ✅ 已统一                         |
| `exists`            | ✅       | ✅         | ✅ 已统一                         |
| `paginate`          | ✅       | ✅         | ✅ 已统一                         |
| `distinct`          | ✅       | ✅         | ✅ 已统一                         |
| `findOrCreate`      | ✅       | ✅         | ✅ 已统一                         |
| `findOneAndUpdate`  | ✅       | ✅         | ✅ 已统一                         |
| `findOneAndDelete`  | ✅       | ✅         | ✅ 已统一                         |
| `findOneAndReplace` | ✅       | ✅         | ✅ 已统一                         |
| `truncate`          | ✅       | ✅         | ✅ 已统一                         |
| `aggregate`         | ❌       | ✅         | ⚠️ 无法统一（SQL 不支持聚合管道） |

#### 静态操作方法

| 方法名            | SQLModel | MongoModel | 统一状态  |
| ----------------- | -------- | ---------- | --------- |
| `create`          | ✅       | ✅         | ✅ 已统一 |
| `createMany`      | ✅       | ✅         | ✅ 已统一 |
| `update`          | ✅       | ✅         | ✅ 已统一 |
| `updateById`      | ✅       | ✅         | ✅ 已统一 |
| `updateMany`      | ✅       | ✅         | ✅ 已统一 |
| `delete`          | ✅       | ✅         | ✅ 已统一 |
| `deleteById`      | ✅       | ✅         | ✅ 已统一 |
| `deleteMany`      | ✅       | ✅         | ✅ 已统一 |
| `increment`       | ✅       | ✅         | ✅ 已统一 |
| `decrement`       | ✅       | ✅         | ✅ 已统一 |
| `incrementMany`   | ✅       | ✅         | ✅ 已统一 |
| `decrementMany`   | ✅       | ✅         | ✅ 已统一 |
| `upsert`          | ✅       | ✅         | ✅ 已统一 |
| `restore`         | ✅       | ✅         | ✅ 已统一 |
| `restoreById`     | ✅       | ✅         | ✅ 已统一 |
| `forceDelete`     | ✅       | ✅         | ✅ 已统一 |
| `forceDeleteById` | ✅       | ✅         | ✅ 已统一 |

#### 查询构建器方法（`query()`）

**查询方法：**

| 方法名                     | SQLModel | MongoModel | 统一状态    |
| -------------------------- | -------- | ---------- | ----------- |
| `findAll()`                | ✅       | ✅         | ✅ 已统一   |
| `findOne()`                | ✅       | ✅         | ✅ 已统一   |
| `one()`                    | ✅       | ✅         | ✅ 已统一   |
| `all()`                    | ✅       | ✅         | ✅ 已统一   |
| `findById(id, fields?)`    | ✅       | ✅         | ✅ 已统一   |
| `count()`                  | ✅       | ✅         | ✅ 已统一   |
| `exists()`                 | ✅       | ✅         | ✅ 已统一   |
| `distinct(field)`          | ✅       | ✅         | ✅ 已统一   |
| `paginate(page, pageSize)` | ✅       | ✅         | ✅ 已统一   |
| `aggregate(pipeline)`      | ❌       | ✅         | ⚠️ 无法统一 |

**操作方法：**

| 方法名                                          | SQLModel | MongoModel | 统一状态  |
| ----------------------------------------------- | -------- | ---------- | --------- |
| `update(data, returnLatest?)`                   | ✅       | ✅         | ✅ 已统一 |
| `updateById(id, data)`                          | ✅       | ✅         | ✅ 已统一 |
| `updateMany(data)`                              | ✅       | ✅         | ✅ 已统一 |
| `increment(field, amount?, returnLatest?)`      | ✅       | ✅         | ✅ 已统一 |
| `decrement(field, amount?, returnLatest?)`      | ✅       | ✅         | ✅ 已统一 |
| `deleteById(id)`                                | ✅       | ✅         | ✅ 已统一 |
| `deleteMany(options?)`                          | ✅       | ✅         | ✅ 已统一 |
| `restore(options?)`                             | ✅       | ✅         | ✅ 已统一 |
| `restoreById(id)`                               | ✅       | ✅         | ✅ 已统一 |
| `forceDelete(options?)`                         | ✅       | ✅         | ✅ 已统一 |
| `forceDeleteById(id)`                           | ✅       | ✅         | ✅ 已统一 |
| `upsert(data, returnLatest?, resurrect?)`       | ✅       | ✅         | ✅ 已统一 |
| `findOrCreate(data, resurrect?)`                | ✅       | ✅         | ✅ 已统一 |
| `findOneAndUpdate(data, options?)`              | ✅       | ✅         | ✅ 已统一 |
| `findOneAndDelete()`                            | ✅       | ✅         | ✅ 已统一 |
| `findOneAndReplace(replacement, returnLatest?)` | ✅       | ✅         | ✅ 已统一 |
| `incrementMany(fieldOrMap, amount?)`            | ✅       | ✅         | ✅ 已统一 |
| `decrementMany(fieldOrMap, amount?)`            | ✅       | ✅         | ✅ 已统一 |

#### 软删除相关方法

| 方法名             | SQLModel | MongoModel | 统一状态  |
| ------------------ | -------- | ---------- | --------- |
| `withTrashed()`    | ✅       | ✅         | ✅ 已统一 |
| `onlyTrashed()`    | ✅       | ✅         | ✅ 已统一 |
| `scope(scopeName)` | ✅       | ✅         | ✅ 已统一 |

#### 实例方法

| 方法名           | SQLModel | MongoModel | 统一状态  |
| ---------------- | -------- | ---------- | --------- |
| `save()`         | ✅       | ✅         | ✅ 已统一 |
| `update(data)`   | ✅       | ✅         | ✅ 已统一 |
| `delete()`       | ✅       | ✅         | ✅ 已统一 |
| `belongsTo(...)` | ✅       | ✅         | ✅ 已统一 |
| `hasOne(...)`    | ✅       | ✅         | ✅ 已统一 |
| `hasMany(...)`   | ✅       | ✅         | ✅ 已统一 |

#### MongoModel 独有方法

| 方法名                  | SQLModel | MongoModel | 统一状态    | 备注             |
| ----------------------- | -------- | ---------- | ----------- | ---------------- |
| `createIndexes(force?)` | ❌       | ✅         | ⚠️ 无法统一 | MongoDB 索引管理 |
| `dropIndexes()`         | ❌       | ✅         | ⚠️ 无法统一 | MongoDB 索引管理 |
| `getIndexes()`          | ❌       | ✅         | ⚠️ 无法统一 | MongoDB 索引管理 |
| `transaction(callback)` | ❌       | ✅         | ⚠️ 无法统一 | MongoDB 事务     |

#### 统一率统计

| 类别                | 总数   | 已统一 | 无法统一 | 统一率    |
| ------------------- | ------ | ------ | -------- | --------- |
| 静态查询方法        | 14     | 13     | 1        | 92.9%     |
| 静态操作方法        | 17     | 17     | 0        | 100%      |
| 查询构建器查询方法  | 10     | 9      | 1        | 90%       |
| 查询构建器操作方法  | 18     | 18     | 0        | 100%      |
| 软删除相关方法      | 3      | 3      | 0        | 100%      |
| 实例方法            | 6      | 6      | 0        | 100%      |
| MongoModel 独有方法 | 4      | 0      | 4        | -         |
| **总计**            | **72** | **66** | **6**    | **91.7%** |

---

