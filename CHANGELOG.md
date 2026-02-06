# Changelog

All notable changes to @dreamer/database are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-06

### Added

- **Stable release**: First stable version with stable API

- **Multi-database adapters**:
  - PostgreSQL adapter (PostgreSQLAdapter) - PostgreSQL 14+
  - MySQL/MariaDB adapter (MySQLAdapter) - MySQL 8.0+
  - SQLite adapter (SQLiteAdapter) - SQLite 3.35.0+, prefers Bun native API
  - MongoDB adapter (MongoDBAdapter) - MongoDB 7.0+
  - Unified DatabaseAdapter interface
  - Runtime database backend switching
  - Multi-database instance support
  - Service container integration

- **ORM/ODM**:
  - SQLModel - Relational database ORM (PostgreSQL, MySQL, SQLite)
  - MongoModel - MongoDB ODM
  - Unified interface (91.7% unification rate between SQLModel and MongoModel)
  - Chained query builder - `query()` and `find()` methods
  - Query conditions - where, orWhere, andWhere, like, orLike, andLike
  - `asArray()` - Returns plain JSON object array
  - Data validation - 30+ validation rules
  - Lifecycle hooks - beforeCreate, afterCreate, beforeUpdate, afterUpdate, etc.
  - Soft delete support
  - Query result caching
  - Associations - belongsTo, hasOne, hasMany

- **Query builder**:
  - SQLQueryBuilder - Relational database query builder
  - MongoQueryBuilder - MongoDB query builder
  - Fluent chained API
  - Full TypeScript type support

- **Migration management**:
  - MigrationManager - Database migration tool
  - SQL migration (PostgreSQL, MySQL, SQLite)
  - MongoDB migration
  - Migration history tracking
  - Migration rollback support

- **Other features**:
  - Transaction support - Basic transactions, nested transactions, savepoints
  - Connection pool management
  - Query logging - Log level filtering, slow query detection, translation `t`, custom logger, debug param
  - Health check - Database connection health check
  - Prepared statements - SQL injection prevention

### Compatibility

- Deno 2.5.0+
- Bun 1.3.0+
- PostgreSQL 14+
- MySQL 8.0+
- SQLite 3.35.0+
- MongoDB 7.0+
