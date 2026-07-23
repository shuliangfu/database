# 变更日志

本文档记录 @dreamer/database 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.2.0] - 2026-07-23

### 新增

- **Node.js 22+ 兼容**：本包现可在 Node.js 22+ 上运行，与 Deno、Bun 三端齐备。
  SQLite 使用内置的 `node:sqlite` 模块（Node 22.x 需传 `--experimental-sqlite`
  标志，23.4+ 起无需标志）。MongoDB / MySQL / PostgreSQL 驱动
  （`mongodb`、`mysql2`、`pg`）经 npm 消费，并采用懒加载——见下。

### 变更

- **适配器懒加载**：`MongoClient`（mongodb）、`Pool`（pg）、`createPool`
  （mysql2）改为在各适配器 `connect()` 方法内动态 `import()`，模块顶部仅保留
  type-only 导入。此举避免 `import @dreamer/database` 时 eager 拉入驱动包
  （及其传递依赖，如 `bson`），此前在 Bun 上会触发
  `NotImplementedError: node:v8 isBuildingSnapshot`。驱动现仅在对应适配器实际
  连接时才解析。
- **SQLiteAdapter**：`node:sqlite` 分支现同时覆盖 Deno 与 Node
  （`IS_DENO || IS_NODE`）；仅对无内置 SQLite 的运行时抛「不支持」错误。
- **依赖**：升级至 Node 兼容版本 ——
  `@dreamer/runtime-adapter@^1.2.2`、`@dreamer/service@^1.1.0`、
  `@dreamer/cache@^1.1.0`、`@dreamer/logger@^1.1.0`、`@dreamer/i18n@^1.1.2`、
  `@dreamer/test@^1.2.3`。`deno.json` 增加 `compilerOptions.lib`
  （`deno.ns`、`deno.window`、`esnext`），以在 `nodeModulesDir: "auto"` 下保留
  `import.meta.main`。

### 基础设施

- **CI**：9 作业矩阵（Deno / Bun / Node.js 22）×（Linux / macOS / Windows）。
  CI 仅运行自包含的 `tests/sqlite/` 套件（19 个文件）；PostgreSQL / MySQL /
  MongoDB / integration 套件（需外部服务）拆分为 `test:integration`，在本地
  运行。Deno 作业使用 `--minimum-dependency-age=0`；Node 作业使用自定义
  `test-node.mjs` 运行器，在主进程内逐文件执行（无 `--test` fork），并传
  `--experimental-sqlite --test-force-exit`。
- **Node 工具链**：新增 `package.json`（`engines.node>=22`、`test:node`、
  `test:integration` 脚本）、`tsconfig.json`（Bundler 模式）、`.npmrc`。
- **文档**：README（中英文）补充 Node.js 22+ 兼容说明（标语、`npx jsr add`
  安装、环境表、懒加载说明）。

---

## [1.1.0] - 2026-04-30

### 修复

- **MongoModel**：对 Node 驱动返回 `{ value: Document | null }` 的类
  `findOneAndUpdate`
  返回值在各消费路径统一解包，`update(..., returnLatest: true)`、增减字段需返回最新文档、软删相关
  modify、等场景不再误判「未匹配」或错误组装实例。
- **MongoModel.findAll**（静态）：在套用软删过滤前，条件与链式 `executeFindAll`
  一致地做规范化（字符串 / `ObjectId` / 对象经 `normalizeCondition`），修复
  `update(...,
  returnLatest: true)` 预查询中 `{ _id: "十六进制字符串" }`
  与库内 `ObjectId` `_id` 对不上的问题。

---

## [1.0.10] - 2026-04-30

### 修复

- **MongoModel.update /
  SQLModel.update**：局部更新不再对「请求体中未出现的字段」套用 schema
  默认值，避免覆盖已有文档/列（例如 MongoDB `$set`
  不再用枚举默认值填齐缺省键）。 `processFields` 支持 `applyDefaults`；update
  路径为 `false`；create / createMany / 方言 upsert 路径为 `true`。

### 变更

- **测试**：MySQL `access` 集成测试在不可连库时跳过；`probeMysqlAvailable()`
  使用快速失败重试； `mysql-test-utils`
  补充前置说明（`CREATE DATABASE`、环境变量等）。

---

## [1.0.9] - 2026-04-17

### 变更

- **MongoDB**：当配置了 `mongoOptions.replicaSet` 且未显式传入
  `directConnection` 时，适配器默认将 `directConnection` 设为
  `true`，与类型文档一致，减轻 Docker 单节点副本集连接问题。仍可通过显式
  `directConnection: false` 覆盖（例如需要 完整副本集发现时）。

---

## [1.0.8] - 2026-02-22

### 移除

- **SQLite**：完全移除 better-sqlite3 回退。SQLite 适配器现仅支持
  Deno（node:sqlite， Deno 2.2+）与 Bun（bun:sqlite），从而消除使用本包时的
  prebuild-install 弃用警告。 在 Node 或原生 SQLite
  不可用时，适配器会抛出明确的配置错误，而不再加载 better-sqlite3。

---

## [1.0.7] - 2026-02-22

### 变更

- **SQLite**：Bun/Node 回退改为直接使用 `npm:better-sqlite3@11.10.0`；不再写入
  `deno.json` 的 imports，避免在 Deno 下触发 prebuild-install 弃用警告。从
  `package.json` 移除 better-sqlite3 的 optionalDependencies。注释更新，说明
  Deno/Bun/Node 及低版本运行时兼容策略。

### 新增

- **文档**：新增 `docs/COMPATIBILITY.md`，分析 Node.js 与 Cloudflare Workers
  的兼容性（现状与可选方案）。

---

## [1.0.6] - 2026-02-19

### 新增

- **MongoDB 时区**：新增 `mongoOptions.timezone`（IANA 时区名，如
  `Asia/Shanghai`、`PRC`）。配置后，MongoModel 会将查询结果中所有 date
  字段格式化为该时区的本地时间字符串，无需在 schema 的每个 date 上写
  `get`。适配器提供可选方法 `getTimezone()`。新增测试：
  `tests/mongo/timezone.test.ts`（6 条）。

### 变更

- **文档**：测试报告与 README 更新为 2,040 条测试（Mongo 523，含时区 6
  条）。TEST_REPORT 依赖版本更新为：@dreamer/test@^1.0.11、
  @dreamer/runtime-adapter@^1.0.15、@dreamer/service@^1.0.2。中英文 API 文档补充
  MongoDB 时区配置及 `mongoOptions.timezone` 说明。

---

## [1.0.5] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。

---

## [1.0.4] - 2026-02-18

### 变更

- **i18n**：仅在入口初始化；`mod.ts` 中调用一次 `initDatabaseI18n()`。`$t()`
  内不再调用 `ensureDatabaseI18n()` 或设置 locale。

---

## [1.0.3] - 2026-02-17

### 新增

- **i18n**：新增对 `@dreamer/i18n` 的依赖。用户可见文案改为基于语言的翻译：通过
  `$t(key, params?, lang?)` 与 `detectLocale()`；新增 `src/locales/zh-CN.json`
  与 `en-US.json`。配置项改为可选 `lang`（不再使用 `t`）；不传 `lang`
  时按环境变量 LANGUAGE / LC_ALL / LANG 检测语言。

### 变更

- **许可证**：更新为 Apache License 2.0。
- **文档**：将 CHANGELOG、TEST_REPORT 及中文 README 迁入 `docs/en-US/` 与
  `docs/zh-CN/`。新增中文测试报告（`docs/zh-CN/TEST_REPORT.md`）。将
  `docs/zh-CN/CHANGELOG-zh.md` 重命名为 `CHANGELOG.md`。根目录 README
  的变更日志与测试报告链接指向 docs 对应文档。

---

## [1.0.2] - 2026-02-07

### 变更

- **文档**：文档结构重组为 `docs/en-US/` 与 `docs/zh-CN/` 以支持中英文双语。新增
  API、FEATURES、EXAMPLES、UNIFIED-INTERFACE 文档，中英文版本齐全。

---

## [1.0.1] - 2026-02-07

### 变更

- **文档**：将代码示例分离至
  [docs/zh-CN/EXAMPLES.md](./docs/zh-CN/EXAMPLES.md)，以缩短 README 长度并改善
  JSR 显示。快速开始、事务处理、关联查询详情、迁移管理示例现链接至独立示例文档。

---

## [1.0.0] - 2026-02-06

### 新增

- **稳定版发布**：首枚稳定版本，API 稳定

- **多数据库适配器**：
  - PostgreSQL 适配器（PostgreSQLAdapter）- PostgreSQL 14+
  - MySQL/MariaDB 适配器（MySQLAdapter）- MySQL 8.0+
  - SQLite 适配器（SQLiteAdapter）- SQLite 3.35.0+，优先使用 Bun 原生 API
  - MongoDB 适配器（MongoDBAdapter）- MongoDB 7.0+
  - 统一 DatabaseAdapter 接口
  - 运行时切换数据库后端
  - 多数据库实例支持
  - 服务容器集成

- **ORM/ODM**：
  - SQLModel - 关系型数据库 ORM（PostgreSQL、MySQL、SQLite）
  - MongoModel - MongoDB ODM
  - 统一接口（SQLModel 与 MongoModel 91.7% 统一率）
  - 链式查询构建器 - `query()` 与 `find()` 方法
  - 查询条件 - where、orWhere、andWhere、like、orLike、andLike
  - `asArray()` - 返回纯 JSON 对象数组
  - 数据验证 - 30+ 种验证规则
  - 生命周期钩子 - beforeCreate、afterCreate、beforeUpdate、afterUpdate 等
  - 软删除支持
  - 查询结果缓存
  - 关联关系 - belongsTo、hasOne、hasMany

- **查询构建器**：
  - SQLQueryBuilder - 关系型数据库查询构建器
  - MongoQueryBuilder - MongoDB 查询构建器
  - 流畅链式 API
  - 完整 TypeScript 类型支持

- **迁移管理**：
  - MigrationManager - 数据库迁移工具
  - SQL 迁移（PostgreSQL、MySQL、SQLite）
  - MongoDB 迁移
  - 迁移历史跟踪
  - 迁移回滚支持

- **其他功能**：
  - 事务支持 - 基本事务、嵌套事务、保存点
  - 连接池管理
  - 查询日志 - 日志级别过滤、慢查询检测、翻译 `t`、自定义 logger、debug 参数
  - 健康检查 - 数据库连接健康检查
  - 预处理语句 - 防止 SQL 注入

### 兼容性

- Deno 2.5.0+
- Bun 1.3.0+
- PostgreSQL 14+
- MySQL 8.0+
- SQLite 3.35.0+
- MongoDB 7.0+
