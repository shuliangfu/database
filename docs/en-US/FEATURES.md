# @dreamer/database Features & Use Cases

> 📖 [README](../../README.md) | [中文 README](../../README-zh.md)

---

## ✨ Characteristics

- **Multi-database adapters**:
  - PostgreSQL adapter (PostgreSQLAdapter) - Full support for PostgreSQL 14+
  - MySQL/MariaDB adapter (MySQLAdapter) - Full support for MySQL 8.0+
  - SQLite adapter (SQLiteAdapter) - Supports SQLite 3.35.0+, prefers Bun native
    API
  - MongoDB adapter (MongoDBAdapter) - Full support for MongoDB 7.0+
  - Unified database interface (DatabaseAdapter) - All adapters implement
    unified interface
  - Runtime database backend switching - Supports dynamic database switching
  - Multi-database instance support - Use multiple database connections
    simultaneously
  - Service container integration - Supports dependency injection and service
    container management

- **ORM/ODM features**:
  - SQLModel - Relational database ORM (PostgreSQL, MySQL, SQLite)
  - MongoModel - MongoDB ODM
  - Unified interface - SQLModel and MongoModel interfaces fully unified (91.7%
    unification rate)
  - Chained query builder - Fluent query API, supports `query()` and `find()`
    methods
  - Query condition methods - `query()` supports `where`, `orWhere`, `andWhere`,
    `like`, `orLike`, `andLike`; `find()` supports `orWhere`, `andWhere`,
    `orLike`, `andLike` (`find()` does not support `where` and `like` because it
    already has initial condition and should not reset)
  - asArray() method - Returns pure JSON object array, supports all chained
    calls and aggregation methods
  - Data validation - 30+ validation rules (see validation rules section)
  - Lifecycle hooks - beforeCreate, afterCreate, beforeUpdate, afterUpdate, etc.
  - Soft delete support - Complete soft delete functionality
  - Query result caching - Auto cache query results
  - Associations - belongsTo, hasOne, hasMany

- **Query builder**:
  - SQLQueryBuilder - Relational database query builder
  - MongoQueryBuilder - MongoDB query builder
  - Chained API - Fluent chained query syntax
  - Type safe - Complete TypeScript type support

- **Migration management**:
  - MigrationManager - Database migration management tool
  - SQL migration support - PostgreSQL, MySQL, SQLite
  - MongoDB migration support - MongoDB collection migration
  - Migration history tracking - Auto record migration history
  - Migration rollback support - Supports migration rollback

- **Other features**:
  - Transaction support - Basic transactions, nested transactions, savepoints
  - Connection pool management - Auto manage database connection pool
  - Query logging - Supports log level filtering, slow query detection,
    translation function `t`, custom `logger`, `debug` parameter
  - Health check - Database connection health check
  - Database initialization tool - Supports auto initialization, config loading
  - Prepared statements - Prevents SQL injection

---

## 🎯 Use Cases

- **Relational database operations**: PostgreSQL, MySQL, SQLite data persistence
- **MongoDB document database operations**: MongoDB collection operations and
  queries
- **ORM/ODM development**: Use models for database operations
- **Multi-database projects**: Use relational database and MongoDB
  simultaneously
