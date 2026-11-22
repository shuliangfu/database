# @dreamer/database 运行时兼容性分析

本文档说明 `@dreamer/database@1.2.0` 在 **Deno**、**Bun**、**Node.js 22+** 与
**Cloudflare Workers** 上的兼容性。内容与当前变更日志、中英文 README 对齐。

---

## 一、当前支持情况（结论）

| 运行时         | 是否兼容  | 说明                                                                    |
| -------------- | --------- | ----------------------------------------------------------------------- |
| **Deno**       | ✅ 支持   | 官方目标运行时（2.5+）                                                  |
| **Bun**        | ✅ 支持   | 官方目标运行时（1.3+）                                                  |
| **Node.js**    | ✅ 支持   | 1.2.0 起支持 Node.js 22+；SQLite 走内置 `node:sqlite`（见下）           |
| **CF Workers** | ❌ 不支持 | 无持久化文件系统、无内置 SQLite、传统 TCP 驱动不适用于 Workers 隔离环境 |

> 数据库适配器（`mongodb` / `pg` /
> `mysql2`）为懒加载：`import
> "@dreamer/database"`
> 不会立即拉取驱动包，仅在对应适配器的 `connect()` 被调用时才解析。

---

## 二、Node.js 22+（已支持）

自 **1.2.0**（2026-07-23）起，本包可在 Node.js 22+ 上与 Deno、Bun 一并使用。

### 2.1 运行时与依赖

- 依赖已升级到兼容 Node 的版本，包括
  `@dreamer/runtime-adapter@^1.2.2`。入口不再因 Node 环境抛出
  `only Bun or
  Deno`。
- MongoDB / MySQL / PostgreSQL 驱动（`mongodb`、`mysql2`、`pg`）经 npm
  消费，并在各适配器的 `connect()` 内动态导入。
- 文件系统相关能力（迁移目录解析、读写迁移文件等）由 runtime-adapter 在 Node
  下提供等价实现，迁移管理器可沿用当前逻辑。

### 2.2 SQLite 在 Node 上的路径

- Deno 与 Node 共用 `node:sqlite` 分支（`IS_DENO || IS_NODE`）。
- **Node 22.x** 使用 `node:sqlite` 时需传入 `--experimental-sqlite`；该标志在
  Node 23.4+ 已取消。
- **1.0.8**（2026-02-22）已完全移除 `better-sqlite3`
  回退。当前适配器只使用各运行时的内置 SQLite：Deno / Node 走 `node:sqlite`，Bun
  走 `bun:sqlite`。若运行时没有内置
  SQLite，适配器会抛出明确的配置错误，而不会再加载 `better-sqlite3`。

### 2.3 各适配器在 Node.js 下的状态

| 适配器     | 状态    | 说明                                                  |
| ---------- | ------- | ----------------------------------------------------- |
| SQLite     | ✅ 支持 | 内置 `node:sqlite`（22.x 需 `--experimental-sqlite`） |
| MongoDB    | ✅ 支持 | 官方 `mongodb` 驱动，基于 TCP                         |
| PostgreSQL | ✅ 支持 | `pg`，基于 TCP                                        |
| MySQL      | ✅ 支持 | `mysql2`，基于 TCP                                    |
| 迁移       | ✅ 支持 | 依赖本地文件系统，Node 下可用                         |

安装示例：`npx jsr add @dreamer/database`。CI 与本地 Node 测试使用
`--experimental-sqlite`（见 `test-node.mjs` 与变更日志）。

---

## 三、Cloudflare Workers（仍不支持）

即便包已能在 Node.js 加载，**Cloudflare Workers
仍然不受支持**。这不是入口检测遗漏，而是运行时能力不足。

### 3.1 特有约束

- **无 Node/Deno/Bun 的完整 API**：无持久化 `fs`、无 `node:sqlite`、无
  `bun:sqlite`、无原生 addon。
- **无持久化文件系统**：迁移管理器读写本地迁移文件、SQLite 本地文件库都不可用。
- **网络模型**：仅 `fetch` / `WebSocket` 等标准 API；`pg`、`mysql2`、`mongodb`
  默认走传统 TCP，不适用于 Workers 隔离环境，需 HTTP / WebSocket 或官方推荐的
  serverless 驱动。
- **生命周期**：请求级、无长期进程，连接池语义与 Node / Deno / Bun 不同。

### 3.2 各适配器在 Workers 下的可行性

| 适配器     | 可行性      | 说明                                                                |
| ---------- | ----------- | ------------------------------------------------------------------- |
| SQLite     | ❌ 不可行   | 无文件系统、无内置 / 原生 SQLite                                    |
| MongoDB    | ⚠️ 需换实现 | 需 HTTP 类接口（如 MongoDB Atlas Data API）或官方推荐的 Workers SDK |
| PostgreSQL | ⚠️ 需换实现 | 需 serverless 驱动（如 `@neondatabase/serverless`）                 |
| MySQL      | ⚠️ 需换实现 | 需 serverless / HTTP 型驱动（如 PlanetScale serverless）            |
| 迁移       | ❌ 不可用   | 依赖本地文件系统；需改为远程加载或在其他环境执行                    |

若将来要支持 Workers，需要单独做：运行时识别、条件加载（不把迁移 / SQLite 打进
Workers 包）、以及基于 HTTP / serverless 的适配器。这些不在当前 1.2.0
的支持范围内。

---

## 四、总结表

| 能力                 | Deno             | Bun             | Node.js 22+                                         | CF Workers               |
| -------------------- | ---------------- | --------------- | --------------------------------------------------- | ------------------------ |
| 包能否加载           | ✅               | ✅              | ✅                                                  | ❌                       |
| SQLite               | ✅ `node:sqlite` | ✅ `bun:sqlite` | ✅ `node:sqlite`（22.x 需 `--experimental-sqlite`） | ❌ 不可用                |
| MongoDB              | ✅               | ✅              | ✅                                                  | ⚠️ 需 HTTP / Data API 等 |
| PostgreSQL           | ✅               | ✅              | ✅                                                  | ⚠️ 需 serverless 驱动    |
| MySQL                | ✅               | ✅              | ✅                                                  | ⚠️ 需 serverless 驱动    |
| 迁移（读写本地文件） | ✅               | ✅              | ✅                                                  | ❌ 需改为远程 / 禁用     |

- **Node.js 22+**：已作为官方支持运行时。SQLite 使用内置 `node:sqlite`，不再提供
  `better-sqlite3` 回退。
- **CF Workers**：当前明确不支持；除缺少文件系统和内置 SQLite 外，传统 TCP
  驱动也不适用，需要专门的 Workers 方案后才能考虑。

以上为 `@dreamer/database@1.2.0` 对 Deno、Bun、Node.js 与 Cloudflare Workers
的兼容性说明，以本版本代码、变更日志和 README 为准。
