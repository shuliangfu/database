# Changelog

All notable changes to @dreamer/database are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-07-23

### Added

- **Node.js 22+ compatibility**: The package now runs on Node.js 22+ alongside
  Deno and Bun. SQLite uses the built-in `node:sqlite` module (pass
  `--experimental-sqlite` on Node 22.x; unflagged in 23.4+). The MongoDB, MySQL,
  and PostgreSQL drivers (`mongodb`, `mysql2`, `pg`) are consumed via npm and
  resolved lazily — see below.

### Changed

- **Lazy-loading adapters**: `MongoClient` (mongodb), `Pool` (pg), and
  `createPool` (mysql2) are now imported dynamically inside each adapter's
  `connect()` method, while only type-only imports remain at the top of the
  module. This prevents eager loading of driver packages (and their transitive
  deps, e.g. `bson`) when importing `@dreamer/database`, which previously
  triggered `NotImplementedError: node:v8 isBuildingSnapshot` on Bun. Drivers
  are now resolved only when the corresponding adapter actually connects.
- **SQLiteAdapter**: The `node:sqlite` branch now covers both Deno and Node
  (`IS_DENO || IS_NODE`); the unsupported-runtime error is only raised for
  runtimes without a built-in SQLite.
- **Dependencies**: Bumped to Node-compatible versions —
  `@dreamer/runtime-adapter@^1.2.2`, `@dreamer/service@^1.1.0`,
  `@dreamer/cache@^1.1.0`, `@dreamer/logger@^1.1.0`, `@dreamer/i18n@^1.1.2`,
  `@dreamer/test@^1.2.3`. `deno.json` gains `compilerOptions.lib`
  (`deno.ns`, `deno.window`, `esnext`) so `import.meta.main` is retained under
  `nodeModulesDir: "auto"`.

### Infrastructure

- **CI**: 9-job matrix (Deno / Bun / Node.js 22) × (Linux / macOS / Windows).
  CI runs the self-contained `tests/sqlite/` suite (19 files); the
  PostgreSQL / MySQL / MongoDB / integration suites (which require external
  servers) are split into `test:integration` and run locally. Deno jobs use
  `--minimum-dependency-age=0`; Node jobs use a custom `test-node.mjs` runner
  that executes each file in-process (no `--test` fork) with
  `--experimental-sqlite --test-force-exit`.
- **Node tooling**: Added `package.json` (`engines.node>=22`, `test:node`,
  `test:integration` scripts), `tsconfig.json` (Bundler mode), `.npmrc`.
- **Documentation**: README (en + zh-CN) documents Node.js 22+ compatibility
  (tagline, install via `npx jsr add`, environment table, lazy-loading note).

---

## [1.1.0] - 2026-04-30

### Fixed

- **MongoModel**: `findOneAndUpdate`-style driver responses that wrap the
  document in `{ value }` are now unwrapped everywhere they are consumed, so
  `update(..., returnLatest: true)`, increment/decrement return-latest paths,
  soft-delete modify helpers, and related flows no longer mis-handle results or
  report zero rows incorrectly.
- **MongoModel.findAll** (static): Query filters are normalized the same way as
  chained `executeFindAll` (string / `ObjectId` / object via
  `normalizeCondition`) before applying soft-delete scopes. This fixes
  pre-queries inside `update(..., returnLatest: true)` when callers pass
  `{ _id: "<hex>" }` against documents stored with `ObjectId` `_id`.

---

## [1.0.10] - 2026-04-30

### Fixed

- **MongoModel.update / SQLModel.update**: Partial updates no longer apply
  schema defaults to keys omitted from the payload, so existing document/column
  values are not overwritten (e.g. MongoDB `$set` no longer fills missing keys
  with enum defaults). `processFields` accepts `applyDefaults`; update paths use
  `false`; create / createMany / dialect upsert paths use `true`.

### Changed

- **Tests**: MySQL `access` integration tests skip when the server is
  unreachable; `probeMysqlAvailable()` uses fast-fail retries;
  `mysql-test-utils` documents prerequisites (`CREATE DATABASE`, env vars).

---

## [1.0.9] - 2026-04-17

### Changed

- **MongoDB**: When `mongoOptions.replicaSet` is set and `directConnection` is
  omitted, the adapter now defaults `directConnection` to `true`, matching the
  documented behavior and reducing Docker single-node replica set connection
  issues. An explicit `directConnection: false` still overrides this (e.g. for
  full replica set discovery).

---

## [1.0.8] - 2026-02-22

### Removed

- **SQLite**: Removed better-sqlite3 fallback entirely. SQLite adapter now only
  supports Deno (node:sqlite, Deno 2.2+) and Bun (bun:sqlite). This eliminates
  the prebuild-install deprecation warning when using the package. On Node or
  when native SQLite is unavailable, the adapter throws a clear config error
  instead of loading better-sqlite3.

---

## [1.0.7] - 2026-02-22

### Changed

- **SQLite**: Use `npm:better-sqlite3@11.10.0` directly for Bun/Node fallback;
  no longer listed in `deno.json` imports to avoid prebuild-install deprecation
  warning when using Deno. Removed `optionalDependencies` for better-sqlite3
  from `package.json`. Comments updated to clarify Deno/Bun/Node and low-version
  runtime compatibility.

### Added

- **Documentation**: Added `docs/COMPATIBILITY.md` with analysis of Node.js and
  Cloudflare Workers compatibility (current status and options).

---

## [1.0.6] - 2026-02-19

### Added

- **MongoDB timezone**: Added `mongoOptions.timezone` (IANA timezone name, e.g.
  `Asia/Shanghai`, `PRC`). When set, MongoModel formats all date fields in query
  results as local time strings in that timezone; no need to add `get` on each
  date field in schema. Adapter exposes optional `getTimezone()`. New tests:
  `tests/mongo/timezone.test.ts` (6 cases).

### Changed

- **Documentation**: Test report and README updated to 2,040 tests (Mongo 523,
  including 6 timezone tests). TEST_REPORT dependency versions updated:
  @dreamer/test@^1.0.11, @dreamer/runtime-adapter@^1.0.15,
  @dreamer/service@^1.0.2. API docs (en-US and zh-CN) document MongoDB timezone
  configuration and `mongoOptions.timezone` usage.

---

## [1.0.5] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages.

---

## [1.0.4] - 2026-02-18

### Changed

- **i18n**: Init at entry only; `initDatabaseI18n()` is called once in `mod.ts`.
  `$t()` no longer calls `ensureDatabaseI18n()` or sets locale internally.

---

## [1.0.3] - 2026-02-17

### Added

- **i18n**: Add dependency on `@dreamer/i18n`. Rewrite user-facing messages to
  use locale-based translation via `$t(key, params?, lang?)` and
  `detectLocale()`. Add `src/locales/zh-CN.json` and `en-US.json`. Config
  accepts `lang` (optional) instead of `t`; omit `lang` to use environment
  (LANGUAGE / LC_ALL / LANG).

### Changed

- **License**: Update to Apache License 2.0.
- **Documentation**: Move CHANGELOG, TEST_REPORT, and Chinese README into
  `docs/en-US/` and `docs/zh-CN/`. Add Chinese test report
  (`docs/zh-CN/TEST_REPORT.md`). Rename `docs/zh-CN/CHANGELOG-zh.md` to
  `CHANGELOG.md`. Root README now links to docs for changelog and test report.

---

## [1.0.2] - 2026-02-07

### Changed

- **Documentation**: Restructure docs into `docs/en-US/` and `docs/zh-CN/` for
  bilingual support. Add API, FEATURES, EXAMPLES, UNIFIED-INTERFACE documents in
  both languages.

---

## [1.0.1] - 2026-02-07

### Changed

- **Documentation**: Extract code examples to
  [docs/en-US/EXAMPLES.md](./docs/en-US/EXAMPLES.md) for reduced README size and
  better JSR display. Quick Start, Transaction Handling, Association Query
  Details, and Migration Management examples now link to the separate examples
  document.

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
  - Query logging - Log level filtering, slow query detection, translation `t`,
    custom logger, debug param
  - Health check - Database connection health check
  - Prepared statements - SQL injection prevention

### Compatibility

- Deno 2.5.0+
- Bun 1.3.0+
- PostgreSQL 14+
- MySQL 8.0+
- SQLite 3.35.0+
- MongoDB 7.0+
