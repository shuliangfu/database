# @dreamer/database

> A database utility library compatible with Deno and Bun, providing a unified
> abstraction layer for multiple databases, with complete ORM/ODM, query
> builder, and migration management features

English | [中文 (Chinese)](./docs/zh-CN/README.md)

[![JSR](https://jsr.io/badges/@dreamer/database)](https://jsr.io/@dreamer/database)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-2,040%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

**Changelog**: [English](./docs/en-US/CHANGELOG.md) |
[中文 (Chinese)](./docs/zh-CN/CHANGELOG.md)

### [1.0.8] - 2026-02-22

- **Removed**: better-sqlite3 fallback; SQLite adapter only supports Deno
  (node:sqlite) and Bun (bun:sqlite). Eliminates prebuild-install deprecation
  warning.
- **Changelog**: [English](./docs/en-US/CHANGELOG.md) |
  [中文](./docs/zh-CN/CHANGELOG.md)

---

## 🎯 Features

A performance-optimized database utility library that supports PostgreSQL,
MySQL, SQLite, MongoDB and other databases through a unified abstraction layer,
providing complete ORM/ODM, query builder, and migration management features.

---

## 📦 Installation

### Deno

```bash
deno add jsr:@dreamer/database
```

### Bun

```bash
bunx jsr add @dreamer/database
```

---

## 🌍 Environment Compatibility

| Environment      | Version Requirement | Status                                                                          |
| ---------------- | ------------------- | ------------------------------------------------------------------------------- |
| **Deno**         | 2.5+                | ✅ Fully supported                                                              |
| **Bun**          | 1.0+                | ✅ Fully supported                                                              |
| **Server**       | -                   | ✅ Supported (compatible with Deno and Bun runtimes, requires database driver)  |
| **Client**       | -                   | ❌ Not supported (browser cannot connect to database directly)                  |
| **Dependencies** | -                   | 📦 Requires corresponding database drivers (PostgreSQL, MySQL, SQLite, MongoDB) |

---

## ✨ Characteristics & Use Cases

> 📖 **Full details**: See [docs/en-US/FEATURES.md](./docs/en-US/FEATURES.md)

---

## 🚀 Quick Start

> 📖 **Full examples**: See [docs/en-US/EXAMPLES.md](./docs/en-US/EXAMPLES.md)
> for Basic Database Operations, SQLModel ORM, MongoModel ODM, Transaction
> Handling, Association Queries, and Migration Management.

```typescript
import { getDatabase, initDatabase } from "jsr:@dreamer/database";

await initDatabase({
  adapter: "sqlite",
  connection: { filename: ":memory:" },
});

const db = getDatabase();
const users = await db.query("SELECT * FROM users WHERE age > ?", [18]);
```

---

## 📚 API Documentation

> 📖 **Full API Reference**: See [docs/en-US/API.md](./docs/en-US/API.md) for
> Database Initialization, SQLModel API, MongoModel API, Query Builder, and
> more.

---

## 🔄 Transaction Handling

> 📖 **Examples**: See
> [docs/en-US/EXAMPLES.md#transaction-handling](./docs/en-US/EXAMPLES.md#transaction-handling)
> for Basic Transaction, Nested Transactions (Savepoints), and MongoDB
> Transaction.

---

## 🔗 Association Query Details

> 📖 **Examples**: See
> [docs/en-US/EXAMPLES.md#association-query-details](./docs/en-US/EXAMPLES.md#association-query-details)
> for belongsTo, hasOne, and hasMany.

---

## 📦 Migration Management

> 📖 **Examples**: See
> [docs/en-US/EXAMPLES.md#migration-management](./docs/en-US/EXAMPLES.md#migration-management)
> for Create, Run, Rollback, and Status.

---

## 🔄 SQLModel and MongoModel Unified Interface

> 📖 **Full comparison**: See
> [docs/en-US/UNIFIED-INTERFACE.md](./docs/en-US/UNIFIED-INTERFACE.md) for the
> 91.7% unified interface between SQLModel and MongoModel.

---

## 📊 Test Report

This library is fully tested. All 2,040 test cases pass with 100% coverage. See
[TEST_REPORT.md](./docs/en-US/TEST_REPORT.md) for details.

**Test Statistics:**

- **Total tests**: 2,040 (integration 5 + mongo 523 + mysql 501 + postgresql
  508 + sqlite 503)
- **Passed**: 2,040 ✅
- **Failed**: 0
- **Pass rate**: 100% ✅
- **Execution time**: ~195s (Deno, per-adapter)
- **Test files**: 82
- **Environments**: Deno 2.5.0+, Bun 1.3.0+

**Tests per adapter:**

| Adapter                     | Tests | Time |
| --------------------------- | ----- | ---- |
| integration (multi-adapter) | 5     | -    |
| MongoDB                     | 523   | ~35s |
| MySQL                       | 501   | ~46s |
| PostgreSQL                  | 508   | ~40s |
| SQLite                      | 503   | ~8s  |

**Highlights:**

- ✅ All 4 adapters (MySQL, PostgreSQL, SQLite, MongoDB) pass
- ✅ Multi-adapter integration (MySQL, SQLite, MongoDB)
- ✅ QueryLogger with t, logger, debug params
- ✅ `query()` and `find()` support full query condition API
- ✅ 30+ validation rules all pass
- ✅ Soft delete, associations, transactions all pass
- ✅ No resource leaks, stable under load

Full report: [TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)

---

## ⚡ Performance

- **Connection pool**: Auto-managed, improves concurrency
- **Query cache**: ORM supports result caching
- **Prepared statements**: All SQL uses prepared statements (SQL injection safe,
  faster)
- **Batch ops**: Batch create, update, delete
- **Index management**: Index create/manage (MongoDB)
- **Async**: All operations async, non-blocking

---

## 📝 Notes

- **Server-only**: Database connections are server-side; client not supported
- **Unified interface**: Adapter pattern, multiple backends
- **Type-safe**: Full TypeScript support
- **Dependencies**: Requires DB drivers (PostgreSQL, MySQL, SQLite, MongoDB)
- **Cross-runtime**: Deno 2.5.0+ and Bun 1.3.0+, tested in both
- **Bun native**: SQLiteAdapter prefers Bun native SQLite API for better
  performance
- **Test coverage**: 2,040 tests, 100% core coverage
- **Real DB tests**: All tests use real DB instances

---

## 📋 Changelog

**v1.0.8** (2026-02-22): Removed better-sqlite3 fallback; SQLite adapter only
supports Deno and Bun. Eliminates prebuild-install deprecation warning.

See [CHANGELOG.md](./docs/en-US/CHANGELOG.md) for full details.

---

## 🤝 Contributing

Issues and Pull Requests welcome!

---

## 📄 License

Apache License 2.0 - see [LICENSE](./LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
