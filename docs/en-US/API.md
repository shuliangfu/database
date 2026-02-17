# @dreamer/database API Reference

> 📖 [README](../../README.md) | [中文 README](../../README-zh.md) |
> [Examples](./EXAMPLES.md)

---

## 📚 API Documentation

### Database Initialization

#### initDatabase

Initialize database connection.

```typescript
initDatabase(config: DatabaseConfig, connectionName?: string): Promise<ConnectionStatus>
```

**Parameters:**

- `config: DatabaseConfig` - Database configuration
- `connectionName?: string` - Connection name (default: 'default')

**Returns:** `Promise<ConnectionStatus>` - Connection status information

**Example:**

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
  // MongoDB specific configuration options (optional)
  mongoOptions: {
    // Server selection timeout (ms), default: 30000
    serverSelectionTimeoutMS: 30000,
    // Connection timeout (ms), default: 5000
    connectTimeoutMS: 5000,
    // Socket timeout (ms), default: 5000
    socketTimeoutMS: 5000,
    // Replica set name (required if MongoDB uses replica set)
    replicaSet: "rs0",
    // Use direct connection mode (recommended true for single-node replica set)
    directConnection: true,
    // Connection pool configuration
    maxPoolSize: 10,
    minPoolSize: 2,
  },
});
```

#### Database Configuration Parameters and Environment Variables

Each database supports overriding connection configuration via environment
variables for testing and deployment:

**MySQL/MariaDB**:

| Environment Variable | Default     | Description   |
| -------------------- | ----------- | ------------- |
| `MYSQL_HOST`         | `127.0.0.1` | Host address  |
| `MYSQL_PORT`         | `3306`      | Port          |
| `MYSQL_DATABASE`     | `test`      | Database name |
| `MYSQL_USER`         | `root`      | Username      |
| `MYSQL_PASSWORD`     | `8866231`   | Password      |

**PostgreSQL**:

| Environment Variable | Default     | Description   |
| -------------------- | ----------- | ------------- |
| `POSTGRES_HOST`      | `localhost` | Host address  |
| `POSTGRES_PORT`      | `5432`      | Port          |
| `POSTGRES_DATABASE`  | `postgres`  | Database name |
| `POSTGRES_USER`      | `root`      | Username      |
| `POSTGRES_PASSWORD`  | `8866231`   | Password      |

**MongoDB**:

| Environment Variable        | Default     | Description                  |
| --------------------------- | ----------- | ---------------------------- |
| `MONGODB_HOST`              | `localhost` | Host address                 |
| `MONGODB_PORT`              | `27017`     | Port                         |
| `MONGODB_DATABASE`          | `test`      | Database name                |
| `MONGODB_USER`              | `root`      | Username (empty for no auth) |
| `MONGODB_PASSWORD`          | `8866231`   | Password                     |
| `MONGODB_AUTH_SOURCE`       | `admin`     | Auth database                |
| `MONGODB_REPLICA_SET`       | `rs0`       | Replica set name             |
| `MONGODB_DIRECT_CONNECTION` | `true`      | Direct connection            |

**Configuration Override**: `config` passed to `initDatabase` takes precedence
over environment variables. Optional overrides:

- **MySQL/PostgreSQL**: `pool` merges connection pool config, `database`
  specifies database name
- **MongoDB**: `mongoOptions` merges MongoDB options (e.g. `maxPoolSize`),
  `database` specifies database name

#### getDatabase

Synchronously get database connection (throws if not initialized).

```typescript
getDatabase(connectionName?: string): DatabaseAdapter
```

#### getDatabaseAsync

Asynchronously get database connection (supports auto-initialization).

```typescript
getDatabaseAsync(connectionName?: string): Promise<DatabaseAdapter>
```

#### closeDatabase

Close all database connections.

```typescript
closeDatabase(): Promise<void>
```

---

## 📖 SQLModel API Reference

SQLModel is the ORM base class for relational databases (PostgreSQL, MySQL,
SQLite), providing full database operation capabilities.

### Model Definition

```typescript
class User extends SQLModel {
  // Table name (required)
  static override tableName = "users";

  // Primary key field name (default: "id")
  static override primaryKey = "id";

  // Field definitions and validation rules
  static override schema = {
    name: { type: "string", validate: { required: true } },
    email: { type: "string", validate: { required: true, unique: true } },
    age: { type: "number", validate: { min: 0, max: 150 } },
  };

  // Soft delete support (optional)
  static override softDelete = true;
  static override deletedAtField = "deleted_at";

  // Timestamp fields (optional)
  static override timestamps = true;
  static override createdAtField = "created_at";
  static override updatedAtField = "updated_at";
}
```

### Data Validation Rules

Database models support rich data validation rules to ensure data integrity and
correctness.

#### Basic Validation

- **`required: boolean`** - Required field
- **`type: FieldType`** - Field type (string, number, boolean, date, etc.)
- **`min: number`** - Minimum value (number) or min length (string)
- **`max: number`** - Maximum value (number) or max length (string)
- **`length: number`** - Fixed length (string)
- **`pattern: RegExp | string`** - Regex validation
- **`enum: any[]`** - Enum value validation
- **`custom: (value: any) => boolean | string`** - Custom validation function

#### Cross-Field Validation

- **`equals: string`** - Equal to another field value
- **`notEquals: string`** - Not equal to another field value
- **`compare: (value, allValues) => boolean | string`** - Custom field
  comparison function
- **`compareValue`** - Cross-table/cross-field value comparison (supports
  cross-table, multiple operators)

#### Database Query Validation (async)

- **`unique: boolean | object`** - Unique in table
- **`exists: boolean | object`** - Exists in table
- **`notExists: boolean | object`** - Does not exist in table

#### Advanced Validation

- **`when`** - Conditional validation (validate based on other field values)
- **`requiredWhen`** - Conditional required (required based on condition)
- **`asyncCustom`** - Async custom validation (database access)
- **`groups: string[]`** - Validation groups (validate only in specified groups)
- **`array`** - Array validation (validate array elements)
- **`format`** - Built-in format validators (email, url, uuid, date, etc.)

#### Numeric Validation

- **`integer: boolean`** - Integer validation
- **`positive: boolean`** - Positive number validation
- **`negative: boolean`** - Negative number validation
- **`multipleOf: number`** - Multiple of validation
- **`range: [number, number]`** - Range validation

#### String Validation

- **`alphanumeric: boolean`** - Alphanumeric validation
- **`numeric: boolean`** - Numeric string validation
- **`alpha: boolean`** - Alpha validation
- **`lowercase: boolean`** - Lowercase validation
- **`uppercase: boolean`** - Uppercase validation
- **`startsWith: string`** - Prefix validation
- **`endsWith: string`** - Suffix validation
- **`contains: string`** - Contains validation
- **`trim: boolean`** - Auto trim leading/trailing spaces
- **`toLowerCase: boolean`** - Auto convert to lowercase
- **`toUpperCase: boolean`** - Auto convert to uppercase

#### Date/Time Validation

- **`before: string | Date`** - Before validation
- **`after: string | Date`** - After validation
- **`beforeTime: string`** - Before time validation
- **`afterTime: string`** - After time validation
- **`timezone: string`** - Timezone validation

#### Password Validation

- **`passwordStrength`** - Password strength validation (min length, case,
  digits, symbols)

#### Validation Example

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
        exists: true, // Must exist in categories table
      },
    },
  };
}
```

> 💡 **Tip**: Data validation rules apply to both `SQLModel` and `MongoModel`,
> using the same validation rules.

### Static Query Methods

#### find

Find records by ID or conditions.

```typescript
// Find by ID
const user = await User.find(1);

// Find by condition
const user = await User.find({ email: "alice@example.com" });
```

#### findAll

Find multiple records.

```typescript
// Find all records
const users = await User.findAll();

// Conditional query
const users = await User.findAll({ age: { $gt: 18 } });

// Sort
const users = await User.findAll({}, { sort: { age: "desc" } });

// Pagination
const users = await User.findAll({}, { limit: 10, offset: 0 });
```

#### findOne

Find single record.

```typescript
const user = await User.findOne({ email: "alice@example.com" });
```

#### findById

Find record by ID.

```typescript
const user = await User.findById(1);
```

#### count

Count records.

```typescript
// Count all records
const total = await User.count();

// Conditional count
const count = await User.count({ age: { $gt: 18 } });
```

#### exists

Check if record exists.

```typescript
const exists = await User.exists({ email: "alice@example.com" });
```

#### paginate

Paginated query.

```typescript
const result = await User.paginate(1, 10, { age: { $gt: 18 } });
// Returns: { data: User[], total: number, page: number, pageSize: number, totalPages: number }
```

#### distinct

Get unique values for a field.

```typescript
const emails = await User.distinct("email");
```

### Static Operation Methods

#### create

Create new record.

```typescript
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
});
```

#### createMany

Batch create records.

```typescript
const users = await User.createMany([
  { name: "Alice", email: "alice@example.com", age: 25 },
  { name: "Bob", email: "bob@example.com", age: 30 },
]);
```

#### update

Update records.

```typescript
// Update by condition
await User.update({ age: { $lt: 18 } }, { status: "minor" });

// Update by ID
await User.update(1, { age: 26 });

// returnLatest option returns updated record
const updated = await User.update(1, { age: 26 }, { returnLatest: true });
```

#### updateById

Update record by ID.

```typescript
await User.updateById(1, { age: 26 });
```

#### updateMany

Batch update records.

```typescript
await User.updateMany({ status: "active" }, { lastLogin: new Date() });
```

#### delete

Delete records (supports soft delete).

```typescript
// Delete by condition
await User.delete({ age: { $lt: 0 } });

// Delete by ID
await User.delete(1);
```

#### deleteById

Delete record by ID.

```typescript
await User.deleteById(1);
```

#### deleteMany

Batch delete records.

```typescript
// Returns count of deleted records
const count = await User.deleteMany({ status: "inactive" });

// returnIds option returns deleted record IDs
const result = await User.deleteMany({ status: "inactive" }, {
  returnIds: true,
});
// Returns: { count: number, ids: any[] }
```

#### increment

Increment field value.

```typescript
// Single field
await User.increment(1, "age", 1);

// Object format (batch increment)
await User.increment(1, { age: 1, score: 10 });

// returnLatest option returns updated record
const updated = await User.increment(1, "age", 5, true);
```

#### decrement

Decrement field value.

```typescript
// Single field
await User.decrement(1, "age", 1);

// Object format (batch decrement)
await User.decrement(1, { age: 1, score: 10 });

// returnLatest option returns updated record
const updated = await User.decrement(1, "age", 5, true);
```

#### incrementMany

Batch increment multiple fields.

```typescript
await User.incrementMany({ status: "active" }, { views: 1, likes: 1 });
```

#### decrementMany

Batch decrement multiple fields.

```typescript
await User.decrementMany({ status: "active" }, { views: 1, likes: 1 });
```

#### upsert

Insert or update record.

```typescript
// Create if not exists, update if exists
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
);

// returnLatest option supported
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  { returnLatest: true },
);

// resurrect option (restore soft-deleted records)
const user = await User.upsert(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  { returnLatest: true, resurrect: true },
);
```

#### findOrCreate

Find or create record.

```typescript
// Return if exists, create if not
const user = await User.findOrCreate(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
);

// resurrect option (restore soft-deleted records)
const user = await User.findOrCreate(
  { email: "alice@example.com" },
  { name: "Alice", age: 25 },
  true, // resurrect
);
```

#### findOneAndUpdate

Find and update record.

```typescript
const user = await User.findOneAndUpdate(
  { email: "alice@example.com" },
  { age: 26 },
);
```

#### findOneAndDelete

Find and delete record.

```typescript
const user = await User.findOneAndDelete({ email: "alice@example.com" });
```

#### findOneAndReplace

Find and replace record.

```typescript
// Returns replaced record
const user = await User.findOneAndReplace(
  { email: "alice@example.com" },
  { name: "Alice Updated", age: 26 },
  { returnLatest: true },
);
```

#### truncate

Truncate table.

```typescript
await User.truncate();
```

### Soft Delete Methods

#### withTrashed

Query including deleted records.

```typescript
const users = await User.withTrashed().findAll();
```

#### onlyTrashed

Query only deleted records.

```typescript
const deletedUsers = await User.onlyTrashed().findAll();
```

#### restore

Restore soft-deleted records.

```typescript
// Restore by condition
await User.restore({ status: "inactive" });

// returnIds option supported
const result = await User.restore({ status: "inactive" }, { returnIds: true });
```

#### restoreById

Restore soft-deleted record by ID.

```typescript
await User.restoreById(1);
```

#### forceDelete

Force delete records (physical delete).

```typescript
// Force delete by condition
await User.forceDelete({ status: "deleted" });

// returnIds option supported
const result = await User.forceDelete({ status: "deleted" }, {
  returnIds: true,
});
```

#### forceDeleteById

Force delete record by ID.

```typescript
await User.forceDeleteById(1);
```

### Chained Query Builder

Get chained query builder via `query()` and `find()` methods. Both support
chaining but differ in usage and features.

#### query() vs find() Comparison

| Feature                     | `query()` | `find()` | Description                                                                        |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------------- |
| **Query Condition Methods** |           |          |                                                                                    |
| `where()`                   | ✅        | ❌       | Set query conditions (resets all prior). `find()` has initial conditions, no reset |
| `orWhere()`                 | ✅        | ✅       | Add OR query condition                                                             |
| `andWhere()`                | ✅        | ✅       | Add AND query condition                                                            |
| `like()`                    | ✅        | ❌       | Set LIKE conditions (resets all prior). `find()` has initial conditions, no reset  |
| `orLike()`                  | ✅        | ✅       | Add OR LIKE query condition                                                        |
| `andLike()`                 | ✅        | ✅       | Add AND LIKE query condition                                                       |
| **Query Methods**           |           |          |                                                                                    |
| `findAll()`                 | ✅        | ✅       | Find multiple records                                                              |
| `findOne()`                 | ✅        | ✅       | Find single record                                                                 |
| `one()`                     | ✅        | ✅       | Find single record (alias)                                                         |
| `all()`                     | ✅        | ✅       | Find multiple records (alias)                                                      |
| `findById()`                | ✅        | ❌       | Find by ID (find itself needs ID)                                                  |
| **Aggregation Methods**     |           |          |                                                                                    |
| `count()`                   | ✅        | ✅       | Count records                                                                      |
| `exists()`                  | ✅        | ✅       | Check if record exists                                                             |
| `distinct()`                | ✅        | ✅       | Get unique field values                                                            |
| `paginate()`                | ✅        | ✅       | Paginated query                                                                    |
| `aggregate()`               | ✅        | ✅       | Aggregate query (MongoDB only)                                                     |
| **Operation Methods**       |           |          |                                                                                    |
| `update()`                  | ✅        | ❌       | Update records (find is for query, use query for ops)                              |
| `updateById()`              | ✅        | ❌       | Update by ID (find is for query, use query for ops)                                |
| `updateMany()`              | ✅        | ❌       | Batch update (find is for query, use query for ops)                                |
| `deleteById()`              | ✅        | ❌       | Delete by ID (find is for query, use query for ops)                                |
| `deleteMany()`              | ✅        | ❌       | Batch delete (find is for query, use query for ops)                                |
| `increment()`               | ✅        | ❌       | Increment field (find is for query, use query for ops)                             |
| `decrement()`               | ✅        | ❌       | Decrement field (find is for query, use query for ops)                             |
| `incrementMany()`           | ✅        | ❌       | Batch increment (find is for query, use query for ops)                             |
| `decrementMany()`           | ✅        | ❌       | Batch decrement (find is for query, use query for ops)                             |
| `restore()`                 | ✅        | ❌       | Restore soft-deleted (find is for query, use query for ops)                        |
| `restoreById()`             | ✅        | ❌       | Restore by ID (find is for query, use query for ops)                               |
| `forceDelete()`             | ✅        | ❌       | Force delete (find is for query, use query for ops)                                |
| `forceDeleteById()`         | ✅        | ❌       | Force delete by ID (find is for query, use query for ops)                          |
| `upsert()`                  | ✅        | ❌       | Insert or update (find is for query, use query for ops)                            |
| `findOrCreate()`            | ✅        | ❌       | Find or create (find is for query, use query for ops)                              |
| `findOneAndUpdate()`        | ✅        | ❌       | Find and update (find is for query, use query for ops)                             |
| `findOneAndDelete()`        | ✅        | ❌       | Find and delete (find is for query, use query for ops)                             |
| `findOneAndReplace()`       | ✅        | ❌       | Find and replace (find is for query, use query for ops)                            |
| **Other Methods**           |           |          |                                                                                    |
| `sort()`                    | ✅        | ✅       | Sort                                                                               |
| `limit()`                   | ✅        | ✅       | Limit count                                                                        |
| `skip()`                    | ✅        | ✅       | Skip count                                                                         |
| `fields()`                  | ✅        | ✅       | Select fields                                                                      |
| `includeTrashed()`          | ✅        | ✅       | Include deleted records                                                            |
| `onlyTrashed()`             | ✅        | ✅       | Query only deleted records                                                         |
| `asArray()`                 | ✅        | ✅       | Return plain JSON object array                                                     |

**Usage Recommendation:**

- Use `query()`: Build complex queries from scratch, perform update/delete
  operations
- Use `find()`: When you have initial conditions (ID or condition object), focus
  on query operations

#### Query Methods

```typescript
// findAll - Find all records
const users = await User.query()
  .where("age", ">", 18)
  .sort("created_at", "desc")
  .findAll();

// findOne - Find single record
const user = await User.query()
  .where("email", "alice@example.com")
  .findOne();

// one / all - Alias methods
const user = await User.query().where("id", 1).one();
const users = await User.query().where("age", ">", 18).all();

// findById - Find by ID
const user = await User.query().findById(1);
const user = await User.query().findById(1, ["name", "email"]); // Specify fields

// count - Count records
const count = await User.query().where("age", ">", 18).count();

// exists - Check if record exists
const exists = await User.query().where("email", "alice@example.com").exists();

// distinct - Get unique values
const emails = await User.query().distinct("email");

// paginate - Paginated query
const result = await User.query()
  .where("age", ">", 18)
  .paginate(1, 10);
```

#### Operation Methods

```typescript
// update - Update records
await User.query()
  .where("age", ">", 18)
  .update({ status: "adult" });

// update - returnLatest option supported
const updated = await User.query()
  .where("id", 1)
  .update({ age: 26 }, true); // returnLatest

// updateById - Update by ID
await User.query().updateById(1, { age: 26 });

// updateMany - Batch update
await User.query()
  .where("status", "active")
  .updateMany({ lastLogin: new Date() });

// increment - Increment (object format supported)
await User.query()
  .where("id", 1)
  .increment("age", 1);

await User.query()
  .where("id", 1)
  .increment({ age: 1, score: 10 }, true); // returnLatest

// decrement - Decrement (object format supported)
await User.query()
  .where("id", 1)
  .decrement("age", 1);

await User.query()
  .where("id", 1)
  .decrement({ age: 1, score: 10 }, true); // returnLatest

// incrementMany - Batch increment
await User.query()
  .where("status", "active")
  .incrementMany({ views: 1, likes: 1 });

// decrementMany - Batch decrement
await User.query()
  .where("status", "active")
  .decrementMany({ views: 1, likes: 1 });

// deleteById - Delete by ID
await User.query().deleteById(1);

// deleteMany - Batch delete
await User.query()
  .where("status", "inactive")
  .deleteMany();

// deleteMany - returnIds option supported
const result = await User.query()
  .where("status", "inactive")
  .deleteMany({ returnIds: true });

// upsert - Insert or update
const user = await User.query()
  .where("email", "alice@example.com")
  .upsert({ name: "Alice", age: 25 }, true, true); // returnLatest, resurrect

// findOrCreate - Find or create
const user = await User.query()
  .where("email", "alice@example.com")
  .findOrCreate({ name: "Alice", age: 25 }, true); // resurrect

// findOneAndUpdate - Find and update
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndUpdate({ age: 26 });

// findOneAndDelete - Find and delete
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndDelete();

// findOneAndReplace - Find and replace
const user = await User.query()
  .where("email", "alice@example.com")
  .findOneAndReplace({ name: "Alice Updated", age: 26 }, true); // returnLatest

// restore - Restore soft-deleted records
await User.query()
  .where("status", "inactive")
  .restore();

// restore - returnIds option supported
const result = await User.query()
  .where("status", "inactive")
  .restore({ returnIds: true });

// restoreById - Restore by ID
await User.query().restoreById(1);

// forceDelete - Force delete
await User.query()
  .where("status", "deleted")
  .forceDelete();

// forceDelete - returnIds option supported
const result = await User.query()
  .where("status", "deleted")
  .forceDelete({ returnIds: true });

// forceDeleteById - Force delete by ID
await User.query().forceDeleteById(1);
```

#### Chained Condition Building

```typescript
// where - Set query conditions (resets all prior conditions)
const users = await User.query()
  .where({ status: "active" })
  .findAll();

// orWhere - Add OR query condition
const users = await User.query()
  .where({ name: "Alice" })
  .orWhere({ name: "Bob" })
  .findAll();

// andWhere - Add AND query condition
const users = await User.query()
  .where({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .findAll();

// like - Set LIKE query conditions (fuzzy, case-insensitive)
const users = await User.query()
  .like({ name: "Alice" })
  .findAll();

// orLike - Add OR LIKE query condition
const users = await User.query()
  .like({ name: "Alice" })
  .orLike({ name: "Bob" })
  .findAll();

// andLike - Add AND LIKE query condition
const users = await User.query()
  .where({ age: { $gte: 18 } })
  .andLike({ email: "example" })
  .findAll();

// find() supports appending conditions (orWhere, andWhere, orLike, andLike)
// Note: find() does not support where() and like() since it has initial conditions
const users = await User.find({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .orWhere({ status: "inactive" })
  .findAll();

// find() supports fuzzy query (using orLike and andLike)
const users = await User.find({ name: { $like: "%Alice%" } })
  .orLike({ name: "Bob" })
  .findAll();

// fields - Select fields
const users = await User.query()
  .fields(["name", "email"])
  .findAll();

// sort - Sort
const users = await User.query()
  .sort("created_at", "desc")
  .findAll();

// Multi-field sort
const users = await User.query()
  .sort({ age: "desc", name: "asc" })
  .findAll();

// limit / skip - Pagination
const users = await User.query()
  .limit(10)
  .skip(20)
  .findAll();

// includeTrashed - Include deleted records
const users = await User.query()
  .includeTrashed()
  .findAll();

// onlyTrashed - Query only deleted records
const users = await User.query()
  .onlyTrashed()
  .findAll();

// scope - Scope query
const users = await User.scope("active").findAll();
```

#### asArray() - Return Plain JSON Object Array

The `asArray()` method converts query results to plain JSON object arrays
instead of model instances. Useful for API responses, serialization, etc.

**Features:**

- Returns plain JSON object array (`Record<string, any>[]`), not model instances
- Supports all chained methods (sort, limit, skip, fields, etc.)
- Supports aggregation methods (count, exists, distinct, paginate)
- Returned objects are safe for JSON serialization
- Returned objects have no model methods (e.g. `save`, `update`)

**Usage:**

```typescript
// find().asArray() returns plain JSON object array
const users = await User.find({ status: "active" })
  .asArray()
  .findAll();

// find().asArray() returns plain JSON object or null
const user = await User.find({ status: "active" })
  .asArray()
  .findOne();

// query().where().asArray() returns plain JSON object array
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .findAll();

// Supports chained sort, limit, skip, etc.
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .sort({ age: "desc" })
  .limit(10)
  .skip(20)
  .findAll();

// Supports fields selection
const user = await User.query()
  .where({ status: "active" })
  .asArray()
  .fields(["name", "age"])
  .findOne();

// Supports aggregation methods
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

// Supports pagination
const result = await User.query()
  .where({ status: "active" })
  .asArray()
  .paginate(1, 10);

// Supports alias methods all() and one()
const users = await User.find({ status: "active" })
  .asArray()
  .all();

const user = await User.find({ status: "active" })
  .asArray()
  .one();

// Complex chained calls
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .sort({ age: "desc" })
  .skip(5)
  .limit(10)
  .findAll();

// Verify returned plain JSON object
const users = await User.query()
  .where({ status: "active" })
  .asArray()
  .findAll();

// Safe for JSON serialization
const json = JSON.stringify(users);
const parsed = JSON.parse(json);

// Returned object has no model methods
const user = await User.find({ status: "active" })
  .asArray()
  .findOne();

console.log(typeof user?.save); // "undefined"
console.log(user?.constructor.name); // "Object" not "User"
```

**Notes:**

- `asArray()` returns plain JSON objects, cannot call model methods (`save`,
  `update`, `delete`, etc.)
- Use regular `find()` or `query()` if you need model instance features
- Returned objects use shallow copy (`{ ...row }`), better performance than
  `JSON.parse(JSON.stringify())`

### Instance Methods

#### save

Save instance (create or update).

```typescript
const user = new User();
user.name = "Alice";
user.email = "alice@example.com";
await user.save(); // Create

user.age = 26;
await user.save(); // Update
```

#### update

Update instance.

```typescript
await user.update({ age: 26 });
```

#### delete

Delete instance.

```typescript
await user.delete();
```

### Association Queries

#### belongsTo

Many-to-one (current model belongs to another).

```typescript
// Define association
const author = await post.belongsTo(User, "user_id", "id");

// Field selection supported
const author = await post.belongsTo(User, "user_id", "id", ["name", "email"]);

// includeTrashed option supported
const author = await post.belongsTo(User, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

#### hasOne

One-to-one (current model has one associated model).

```typescript
// Define association
const profile = await user.hasOne(Profile, "user_id", "id");

// Field selection supported
const profile = await user.hasOne(Profile, "user_id", "id", ["bio", "avatar"]);

// includeTrashed option supported
const profile = await user.hasOne(Profile, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

#### hasMany

One-to-many (current model has many associated models).

```typescript
// Define association
const posts = await user.hasMany(Post, "user_id", "id");

// Field selection supported
const posts = await user.hasMany(Post, "user_id", "id", ["title", "content"]);

// options param (sort, pagination, etc.) supported
const posts = await user.hasMany(Post, "user_id", "id", undefined, {
  sort: { created_at: "desc" },
  limit: 10,
});

// includeTrashed option supported
const posts = await user.hasMany(
  Post,
  "user_id",
  "id",
  undefined,
  undefined,
  true,
);

// onlyTrashed option supported (query only deleted)
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

### Lifecycle Hooks

```typescript
class User extends SQLModel {
  static override tableName = "users";

  // beforeCreate hook
  static override beforeCreate(data: any) {
    data.created_at = new Date();
    return data;
  }

  // afterCreate hook
  static override afterCreate(instance: any) {
    console.log("User created:", instance.id);
  }

  // beforeUpdate hook
  static override beforeUpdate(data: any, conditions: any) {
    data.updated_at = new Date();
    return data;
  }

  // afterUpdate hook
  static override afterUpdate(instance: any) {
    console.log("User updated:", instance.id);
  }

  // beforeSave hook (called for both create and update)
  static override beforeSave(data: any) {
    // Handle logic
    return data;
  }

  // afterSave hook
  static override afterSave(instance: any) {
    console.log("User saved:", instance.id);
  }

  // beforeDelete hook
  static override beforeDelete(conditions: any) {
    console.log("Deleting user:", conditions);
  }

  // afterDelete hook
  static override afterDelete(instance: any) {
    console.log("User deleted:", instance.id);
  }

  // beforeValidate hook
  static override beforeValidate(data: any) {
    // Preprocess data
    return data;
  }

  // afterValidate hook
  static override afterValidate(data: any) {
    // Postprocess data
    return data;
  }
}
```

---

## 📖 MongoModel API Reference

MongoModel is the ODM base class for MongoDB, providing full MongoDB operation
capabilities.

### Model Definition

```typescript
class Article extends MongoModel {
  // Collection name (required)
  static override collectionName = "articles";

  // Primary key field (default: "_id")
  static override primaryKey = "_id";

  // Field definitions and validation rules
  static override schema = {
    title: { type: "string", validate: { required: true, max: 200 } },
    content: { type: "string", validate: { required: true } },
    status: {
      type: "string",
      validate: { enum: ["draft", "published", "archived"] },
    },
  };

  // Soft delete support (optional)
  static override softDelete = true;
  static override deletedAtField = "deleted_at";

  // Timestamp fields (optional)
  static override timestamps = true;
  static override createdAtField = "created_at";
  static override updatedAtField = "updated_at";

  // Index definitions (optional)
  static override indexes = [
    { fields: { title: 1 }, options: { unique: true } },
    { fields: { status: 1, created_at: -1 } },
  ];
}
```

### Data Validation Rules

MongoModel validation rules are identical to SQLModel. See
[SQLModel Data Validation Rules](#data-validation-rules).

### Static Query Methods

MongoModel static query methods are identical to SQLModel. See
[SQLModel docs](#static-query-methods).

### Static Operation Methods

MongoModel static operation methods are identical to SQLModel. See
[SQLModel docs](#static-operation-methods).

### Chained Query Builder

MongoModel chained query builder methods are identical to SQLModel. See
[SQLModel docs](#chained-query-builder).

### MongoModel-Specific Methods

#### createIndexes

Create indexes (from model-defined indexes).

```typescript
// Create all defined indexes
const indexNames = await Article.createIndexes();

// Force recreate indexes (drop then rebuild)
const indexNames = await Article.createIndexes(true);
```

#### dropIndexes

Drop all indexes (except _id).

```typescript
const droppedIndexes = await Article.dropIndexes();
```

#### getIndexes

Get all index information.

```typescript
const indexes = await Article.getIndexes();
```

#### aggregate

Aggregate query (MongoDB-specific).

```typescript
// Static method
const result = await Article.aggregate([
  { $match: { status: "published" } },
  { $group: { _id: "$author", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

// Chained query
const result = await Article.query()
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
  ]);
```

#### transaction

MongoDB transaction (MongoModel-specific).

```typescript
await Article.transaction(async (session) => {
  const article1 = await Article.create({ title: "Article 1" }, { session });
  const article2 = await Article.create({ title: "Article 2" }, { session });
  // Transaction auto-rolls back if any operation fails
});
```

### Instance Methods

MongoModel instance methods are identical to SQLModel. See
[SQLModel docs](#instance-methods).

### Association Queries

MongoModel association query methods are identical to SQLModel. See
[SQLModel docs](#association-queries).

### Lifecycle Hooks

MongoModel lifecycle hooks are identical to SQLModel. See
[SQLModel docs](#lifecycle-hooks).

---

## 🔧 Query Builder Documentation

### SQLQueryBuilder

SQL query builder for complex SQL queries.

#### Basic Usage

```typescript
import { getDatabase, SQLQueryBuilder } from "jsr:@dreamer/database";

const db = getDatabase();
const builder = new SQLQueryBuilder(db);

// SELECT query
const users = await builder
  .select("id", "name", "email")
  .from("users")
  .where("age > ?", [18])
  .orderBy("created_at", "DESC")
  .limit(10)
  .execute();

// INSERT operation
await builder
  .insert("users")
  .values({ name: "Alice", email: "alice@example.com", age: 25 })
  .executeUpdate();

// UPDATE operation
await builder
  .update("users")
  .set({ age: 26 })
  .where("id = ?", [1])
  .executeUpdate();

// DELETE operation
await builder
  .delete("users")
  .where("id = ?", [1])
  .executeUpdate();
```

#### JOIN Query

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

#### Complex Condition Query

```typescript
// Multiple WHERE conditions (AND)
const users = await builder
  .select("*")
  .from("users")
  .where("age > ?", [18])
  .where("status = ?", ["active"])
  .execute();

// OR condition
const users = await builder
  .select("*")
  .from("users")
  .where("age > ?", [18])
  .orWhere("status = ?", ["active"])
  .execute();
```

### MongoQueryBuilder

MongoDB query builder for complex MongoDB queries.

#### Basic Usage

```typescript
import { getDatabase, MongoQueryBuilder } from "jsr:@dreamer/database";

const db = getDatabase();
const builder = new MongoQueryBuilder(db);

// Query documents
const articles = await builder
  .collection("articles")
  .find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(10)
  .query();

// Insert documents
await builder
  .collection("articles")
  .execute()
  .insert({ title: "Hello", content: "World", status: "published" });

// Update documents
await builder
  .collection("articles")
  .find({ status: "draft" })
  .execute()
  .updateMany({ $set: { status: "published" } });

// Delete documents
await builder
  .collection("articles")
  .find({ status: "archived" })
  .execute()
  .deleteMany();
```
