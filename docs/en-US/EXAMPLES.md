# @dreamer/database Examples

> 📖 [README](../../README.md) | [中文 README](../../README-zh.md)

This document contains code examples for @dreamer/database. See [README](../../README.md) for API reference and full documentation.

---

## 🚀 Quick Start

### Basic Database Operations

```typescript
import { getDatabase, initDatabase } from "jsr:@dreamer/database";

// Initialize SQLite database
await initDatabase({
  adapter: "sqlite",
  connection: {
    filename: ":memory:", // or file path
  },
});

// Get database adapter
const db = getDatabase();

// Execute SQL query
const users = await db.query(
  "SELECT * FROM users WHERE age > ?",
  [18],
);

// Execute update operation
await db.execute(
  "INSERT INTO users (name, email) VALUES (?, ?)",
  ["Alice", "alice@example.com"],
);

// Transaction support
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
```

### SQLModel ORM

```typescript
import { initDatabase, SQLModel } from "jsr:@dreamer/database";

// Define user model
class User extends SQLModel {
  static override tableName = "users";
  static override primaryKey = "id";

  // Define fields and validation rules
  static override schema = {
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
        unique: true,
      },
    },
    age: {
      type: "number",
      validate: {
        min: 0,
        max: 150,
      },
    },
  };
}

// Initialize database
await initDatabase({
  adapter: "sqlite",
  connection: { filename: ":memory:" },
});

// Initialize model
await User.init();

// Create user
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
});

// Query user
const foundUser = await User.findById(user.id);

// Chain query using query() method
const users = await User.query()
  .where({ age: { $gt: 18 } })
  .sort({ created_at: "desc" })
  .findAll();

// Chain query using find() method (supports appending query conditions)
const users2 = await User.find({ age: { $gt: 18 } })
  .sort({ created_at: "desc" })
  .findAll();

// find() method supports appending conditions (orWhere, andWhere, orLike, andLike)
const users2a = await User.find({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .orWhere({ status: "inactive" })
  .findAll();

// Chain query using query() method (supports all query condition methods)
const users3 = await User.query()
  .where({ status: "active" })
  .andWhere({ age: { $gte: 18 } })
  .orWhere({ status: "inactive" })
  .findAll();

// Fuzzy query
const users4 = await User.query()
  .like({ name: "Alice" })
  .orLike({ name: "Bob" })
  .findAll();

// find() method also supports fuzzy query (using orLike and andLike)
const users4a = await User.find({ name: { $like: "%Alice%" } })
  .orLike({ name: "Bob" })
  .findAll();

// Return plain JSON object array (not model instances)
const jsonUsers = await User.query()
  .where("age", ">", 18)
  .asArray()
  .findAll();

// Update user
await User.updateById(user.id, { age: 26 });

// Delete user (soft delete)
await User.deleteById(user.id);
```

### MongoModel ODM

```typescript
import { initDatabase, MongoModel } from "jsr:@dreamer/database";

// Define article model
class Article extends MongoModel {
  static override collectionName = "articles";
  static override primaryKey = "_id";

  static override schema = {
    title: {
      type: "string",
      validate: {
        required: true,
        max: 200,
      },
    },
    content: {
      type: "string",
      validate: {
        required: true,
      },
    },
    status: {
      type: "string",
      validate: {
        enum: ["draft", "published", "archived"],
      },
    },
  };
}

// Initialize database
await initDatabase({
  adapter: "mongodb",
  connection: {
    host: "localhost",
    port: 27017,
    database: "mydb",
  },
});

// Initialize model
await Article.init();

// Create article
const article = await Article.create({
  title: "Hello World",
  content: "This is my first article",
  status: "published",
});

// Query articles
const articles = await Article.query()
  .where({ status: "published" })
  .sort({ created_at: -1 })
  .findAll();

// Chain query using find() method
const articles2 = await Article.find({ status: "published" })
  .sort({ created_at: -1 })
  .findAll();

// Return plain JSON object array (not model instances)
const jsonArticles = await Article.query()
  .where("status", "published")
  .asArray()
  .findAll();
```

---

## 🔄 Transaction Handling

### Basic Transaction

```typescript
import { getDatabase } from "jsr:@dreamer/database";

const db = getDatabase();

await db.transaction(async (trx) => {
  await trx.execute("INSERT INTO users (name, email) VALUES (?, ?)", [
    "Alice",
    "alice@example.com",
  ]);
  await trx.execute("INSERT INTO orders (user_id, amount) VALUES (?, ?)", [
    1,
    100,
  ]);
  // Transaction auto-rolls back if any operation fails
});
```

### Nested Transactions (Savepoints)

SQLite, PostgreSQL, MySQL support nested transactions via savepoints.

```typescript
await db.transaction(async (trx) => {
  await trx.execute("INSERT INTO users (name, email) VALUES (?, ?)", [
    "Bob",
    "bob@example.com",
  ]);

  // Create savepoint
  const savepointId = await trx.createSavepoint("sp1");
  try {
    await trx.execute("INSERT INTO orders (user_id, amount) VALUES (?, ?)", [
      2,
      200,
    ]);
    // Release savepoint
    await trx.releaseSavepoint(savepointId);
  } catch (error) {
    // Rollback to savepoint
    await trx.rollbackToSavepoint(savepointId);
    throw error;
  }
});
```

### MongoDB Transaction

```typescript
import { MongoModel } from "jsr:@dreamer/database";

await Article.transaction(async (session) => {
  const article1 = await Article.create({ title: "Article 1" }, { session });
  const article2 = await Article.create({ title: "Article 2" }, { session });
  // Transaction auto-rolls back if any operation fails
});
```

---

## 🔗 Association Query Details

### belongsTo (Many-to-One)

Current model belongs to another. E.g.: Post belongsTo User (a post belongs to a user).

```typescript
class Post extends SQLModel {
  static override tableName = "posts";
}

class User extends SQLModel {
  static override tableName = "users";
}

// Get post author
const post = await Post.findById(1);
const author = await post.belongsTo(User, "user_id", "id");

// Specify fields
const author = await post.belongsTo(User, "user_id", "id", ["name", "email"]);

// Include soft-deleted records
const author = await post.belongsTo(User, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

### hasOne (One-to-One)

Current model has one associated model. E.g.: User hasOne Profile (a user has one profile).

```typescript
class Profile extends SQLModel {
  static override tableName = "profiles";
}

// Get user profile
const user = await User.findById(1);
const profile = await user.hasOne(Profile, "user_id", "id");

// Specify fields
const profile = await user.hasOne(Profile, "user_id", "id", ["bio", "avatar"]);

// Include soft-deleted records
const profile = await user.hasOne(Profile, "user_id", "id", undefined, {
  includeTrashed: true,
});
```

### hasMany (One-to-Many)

Current model has many associated models. E.g.: User hasMany Post (a user has many posts).

```typescript
// Get all user posts
const user = await User.findById(1);
const posts = await user.hasMany(Post, "user_id", "id");

// Specify fields
const posts = await user.hasMany(Post, "user_id", "id", ["title", "content"]);

// options param (sort, pagination, etc.) supported
const posts = await user.hasMany(Post, "user_id", "id", undefined, {
  sort: { created_at: "desc" },
  limit: 10,
  skip: 0,
});

// Include soft-deleted records
const posts = await user.hasMany(
  Post,
  "user_id",
  "id",
  undefined,
  undefined,
  true,
);

// Query only deleted records
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

---

## 📦 Migration Management

### Create Migration

```typescript
import { getDatabase, MigrationManager } from "jsr:@dreamer/database";

const db = getDatabase();
const manager = new MigrationManager({
  migrationsDir: "./migrations",
  adapter: db,
});

// Create new migration file
await manager.create("create_users_table");
```

### Run Migration

```typescript
// Run all pending migrations
await manager.up();

// Run specified number of migrations
await manager.up(2);
```

### Rollback Migration

```typescript
// Rollback most recent migration
await manager.down();

// Rollback specified number of migrations
await manager.down(2);
```

### Check Migration Status

```typescript
const status = await manager.status();
console.log(status);
// Returns: [{ name: "migration_name", executed: true, executedAt: Date }]
```

---

> 📖 **Full API Reference**: See [README](../../README.md) for Database Initialization, SQLModel API, MongoModel API, Query Builder, and more.
