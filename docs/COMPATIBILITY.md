# @dreamer/database 运行时兼容性分析

本文档分析 database 包在 **Cloudflare Workers** 与 **Node.js**
上的兼容性，以及当前仅支持 Deno/Bun 的原因与可选改造方向。

---

## 一、当前支持情况（结论）

| 运行时         | 是否兼容  | 说明                             |
| -------------- | --------- | -------------------------------- |
| **Deno**       | ✅ 支持   | 官方目标运行时                   |
| **Bun**        | ✅ 支持   | 官方目标运行时                   |
| **Node.js**    | ❌ 不兼容 | 入口即抛错，见下                 |
| **CF Workers** | ❌ 不兼容 | 入口即抛错 + 无文件系统/原生能力 |

---

## 二、为何 Node.js 与 CF Workers 不兼容

### 2.1 入口即失败：@dreamer/runtime-adapter

database 依赖 `@dreamer/runtime-adapter`。runtime-adapter
在**模块加载时**会做运行时检测：

- 仅当 `RUNTIME === "deno"` 或 `RUNTIME === "bun"` 时放行；
- 否则（含 Node.js、CF Workers
  等）**直接抛出**：`Error: only Bun or Deno`（或对应 i18n 文案）。

因此：

- **Node.js**：`RUNTIME === "unknown"` → 一 `import("@dreamer/database")`
  就抛错，无法使用。
- **CF Workers**：V8 isolate，既不是 Deno 也不是 Bun → 同样在入口抛错。

也就是说，在讨论各适配器（MongoDB、PostgreSQL、MySQL、SQLite）或迁移、i18n
之前，**整个包在 Node 和 Workers 上已经无法加载**。

### 2.2 database 内对 runtime-adapter 的使用

| 模块                   | 使用内容                                                                            | 用途                                           |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `adapters/sqlite.ts`   | `IS_BUN`, `IS_DENO`                                                                 | 选择 node:sqlite / bun:sqlite / better-sqlite3 |
| `i18n.ts`              | `getEnv`                                                                            | 读环境变量做语言检测                           |
| `migration/manager.ts` | `cwd`, `join`, `readdir`, `realPath`, `stat`, `writeTextFile`, `IS_BUN`, `basename` | 迁移目录解析、动态 import 迁移文件、写文件     |
| `migration/utils.ts`   | `basename`, `extname`, `mkdir`, `stat`                                              | 迁移文件路径与目录操作                         |

一旦支持 Node/Workers，这些 API 需要在这些环境上有等价实现（或条件降级）。

---

## 三、各适配器在 Node.js / CF Workers 下的可行性

### 3.1 SQLite（SQLiteAdapter）

| 运行时         | 可行性    | 说明                                                                         |
| -------------- | --------- | ---------------------------------------------------------------------------- |
| **Node.js**    | ✅ 可行   | 已有 else 分支用 `npm:better-sqlite3@11.10.0`；仅被 runtime-adapter 入口拦下 |
| **CF Workers** | ❌ 不可行 | 无文件系统、无原生 addon；Workers 不支持嵌入式 SQLite                        |

### 3.2 MongoDB（MongoDBAdapter）

| 运行时         | 可行性      | 说明                                                                                                   |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| **Node.js**    | ✅ 可行     | 使用 `mongodb` 官方驱动，基于 TCP，Node 原生支持                                                       |
| **CF Workers** | ⚠️ 需换实现 | 当前驱动依赖 Node 网络/能力；Workers 需改用 HTTP 类接口（如 MongoDB Atlas Data API、Realm Web SDK 等） |

### 3.3 PostgreSQL（PostgreSQLAdapter）

| 运行时         | 可行性      | 说明                                                                                                                  |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| **Node.js**    | ✅ 可行     | 使用 `pg`，基于 TCP，Node 原生支持                                                                                    |
| **CF Workers** | ⚠️ 需换实现 | `pg` 不适合 Workers；需换用 HTTP/WebSocket 的 serverless 驱动（如 `@neondatabase/serverless`、`@vercel/postgres` 等） |

### 3.4 MySQL（MySQLAdapter）

| 运行时         | 可行性      | 说明                                                         |
| -------------- | ----------- | ------------------------------------------------------------ |
| **Node.js**    | ✅ 可行     | 使用 `mysql2`，基于 TCP，Node 原生支持                       |
| **CF Workers** | ⚠️ 需换实现 | 需 serverless 驱动（如 PlanetScale serverless、HTTP 接口等） |

---

## 四、CF Workers 特有约束

- **无 Node/Deno/Bun API**：无 `fs`、无 `node:sqlite`、无 `bun:sqlite`、无原生
  addon。
- **无持久化文件系统**：迁移管理器的读/写迁移文件、SQLite 的本地文件库都不可用。
- **网络**：仅 `fetch` / `WebSocket` 等标准 API；传统 TCP
  型数据库驱动（pg、mysql2、mongodb 默认）不适用，需 HTTP/WebSocket 或官方
  Workers 推荐方案。
- **生命周期**：请求级、无长期进程，连接池语义与 Node/Deno/Bun 不同。

因此，即便去掉 runtime-adapter 的“仅 Deno/Bun”限制，**当前 database 的迁移模块和
SQLite 适配器在 Workers 下也无法直接运行**；MongoDB/PostgreSQL/MySQL 需要换成
Workers 可用的驱动或 HTTP 封装。

---

## 五、若要支持 Node.js：建议改动

1. **放宽 runtime-adapter 的运行时限制**
   - 在 runtime-adapter 中增加 `IS_NODE`（及可选的
     `RUNTIME === "node"`），当运行在 Node 时不再抛错。
   - 或：database 不直接依赖 runtime-adapter 的“仅
     Deno/Bun”断言，改为自检运行时并在不支持时再抛错（例如仅在使用
     SQLite/迁移等依赖运行时特性的功能时检查）。

2. **保证 Node 下 API 可用**
   - `getEnv`、`cwd`、`join`、`readdir`、`realPath`、`stat`、`writeTextFile`、`mkdir`、`basename`、`extname`
     等在 Node 下需有实现（runtime-adapter 若支持 Node，通常会提供这些）。

3. **适配器**
   - SQLite：已有 Node 分支（better-sqlite3），无需再改。
   - MongoDB / PostgreSQL / MySQL：当前驱动在 Node 下可直接用，无需换实现。

4. **迁移**
   - 依赖文件系统；若 runtime-adapter 在 Node 下提供
     `readdir`、`stat`、`writeTextFile` 等，迁移在 Node 上可沿用当前逻辑。

---

## 六、若要支持 CF Workers：建议改动

1. **运行时识别**
   - 在 runtime-adapter 或 database 内识别 Workers（如通过 `globalThis` 上 CF
     特有对象或环境变量），避免在 Workers 里执行“仅
     Deno/Bun”的抛错逻辑，或改为“在 Workers 下仅启用部分能力”。

2. **条件加载 / 分包**
   - Workers 下不加载依赖文件系统或原生能力的模块（例如迁移管理器、SQLite
     适配器），或提供 stub，避免在 Workers 中 import 到
     `fs`/`node:sqlite`/`bun:sqlite`/better-sqlite3。

3. **适配器**
   - **SQLite**：在 Workers 中不提供或明确标注“不支持”。
   - **MongoDB**：接入基于 HTTP 的接口（如 Atlas Data API）或官方推荐的 Workers
     用 SDK。
   - **PostgreSQL**：使用 `@neondatabase/serverless` 等 serverless
     驱动，并可能需新加一个 `PostgreSQLServerlessAdapter` 或通过配置切换实现。
   - **MySQL**：使用 PlanetScale serverless 或其它 HTTP
     型驱动，同样可能需新适配器或配置切换。

4. **迁移**
   - 在 Workers
     中禁用或跳过迁移（无文件系统）；或改为从远程/配置加载迁移定义，由其它环境执行写入。

5. **runtime-adapter 在 Workers 下的实现**
   - 提供不依赖 `fs` 的 stub 或基于 `fetch` 的替代实现；`getEnv` 可用 `env`
     绑定等 Workers 能力实现。

---

## 七、总结表

| 能力                 | Deno                            | Bun                            | Node.js                   | CF Workers             |
| -------------------- | ------------------------------- | ------------------------------ | ------------------------- | ---------------------- |
| 包能否加载           | ✅                              | ✅                             | ❌ (runtime-adapter 抛错) | ❌ (同上)              |
| SQLite               | ✅ node:sqlite / better-sqlite3 | ✅ bun:sqlite / better-sqlite3 | ✅ 逻辑已有，入口被拦     | ❌ 不可用              |
| MongoDB              | ✅                              | ✅                             | ✅ 驱动可用               | ⚠️ 需 HTTP/Data API 等 |
| PostgreSQL           | ✅                              | ✅                             | ✅ 驱动可用               | ⚠️ 需 serverless 驱动  |
| MySQL                | ✅                              | ✅                             | ✅ 驱动可用               | ⚠️ 需 serverless 驱动  |
| 迁移（读写本地文件） | ✅                              | ✅                             | ✅ 若 runtime 提供 fs     | ❌ 需改为远程/禁用     |

- **Node.js**：主要卡在 runtime-adapter 的“仅
  Deno/Bun”限制；放宽后，现有适配器与迁移在 Node 上基本可用，SQLite 已具备 Node
  分支。
- **CF Workers**：除入口限制外，还受无文件系统、无原生/传统 TCP
  驱动的约束；需专门为 Workers 做运行时识别、条件加载、以及基于 HTTP/serverless
  的适配器与迁移策略。

以上为当前 @dreamer/database 对 **CF Workers** 与 **Node.js**
的兼容性分析；实现时以 runtime-adapter 的改动和 Workers 专用适配器/配置为主。
