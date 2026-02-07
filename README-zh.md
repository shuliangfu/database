# @dreamer/database

> 一个兼容 Deno 和 Bun
> 的数据库工具库，提供统一的抽象层支持多种数据库，提供完整的
> ORM/ODM、查询构建器和迁移管理功能

[English](./README.md) | 中文 (Chinese)

[![JSR](https://jsr.io/badges/@dreamer/database)](https://jsr.io/@dreamer/database)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-1,954%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

一个经过性能优化的数据库工具库，通过统一的抽象层支持 PostgreSQL、MySQL、SQLite、MongoDB 等多种数据库，提供完整的 ORM/ODM、查询构建器和迁移管理功能。

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/database
```

### Bun

```bash
bunx jsr add @dreamer/database
```

---

## 🌍 环境兼容性

| 环境       | 版本要求 | 状态                                                          |
| ---------- | -------- | ------------------------------------------------------------- |
| **Deno**   | 2.5+     | ✅ 完全支持                                                   |
| **Bun**    | 1.0+     | ✅ 完全支持                                                   |
| **服务端** | -        | ✅ 支持（兼容 Deno 和 Bun 运行时，需要数据库驱动）            |
| **客户端** | -        | ❌ 不支持（浏览器环境无法直接连接数据库）                     |
| **依赖**   | -        | 📦 需要相应的数据库驱动（PostgreSQL、MySQL、SQLite、MongoDB） |

---

## ✨ 特性与使用场景

> 📖 **完整说明**：参见 [docs/zh-CN/FEATURES.md](./docs/zh-CN/FEATURES.md)

---

## 🚀 快速开始

> 📖 **完整示例**：参见 [docs/zh-CN/EXAMPLES.md](./docs/zh-CN/EXAMPLES.md)，包含基础数据库操作、SQLModel ORM、MongoModel ODM、事务处理、关联查询、迁移管理等。

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

## 📚 API 文档

> 📖 **完整 API 参考**：参见 [docs/zh-CN/API.md](./docs/zh-CN/API.md)，包含数据库初始化、SQLModel API、MongoModel API、查询构建器等。

---

## 🔄 事务处理

> 📖 **示例**：参见 [docs/zh-CN/EXAMPLES.md#transaction-handling](./docs/zh-CN/EXAMPLES.md#transaction-handling)

---

## 🔗 关联查询详细说明

> 📖 **示例**：参见 [docs/zh-CN/EXAMPLES.md#association-query-details](./docs/zh-CN/EXAMPLES.md#association-query-details)

---

## 📦 迁移管理

> 📖 **示例**：参见 [docs/zh-CN/EXAMPLES.md#migration-management](./docs/zh-CN/EXAMPLES.md#migration-management)

---

## 🔄 SQLModel 与 MongoModel 统一接口

> 📖 **完整对比**：参见 [docs/zh-CN/UNIFIED-INTERFACE.md](./docs/zh-CN/UNIFIED-INTERFACE.md)


---

## 📊 测试报告

本库经过全面测试，所有 1,954 个测试用例均已通过，测试覆盖率达到
100%。详细测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)。

**测试统计**：

- **总测试数**: 1,954（integration 4 + mongo 497 + mysql 481 + postgresql 488 + sqlite 484）
- **通过**: 1,954 ✅
- **失败**: 0
- **通过率**: 100% ✅
- **测试执行时间**: ~129秒（Deno 环境，分库执行）
- **测试文件数**: 81 个
- **测试环境**: Deno 2.5.0+, Bun 1.3.0+

**各适配器测试数**：

| 适配器 | 测试数 | 执行时间 |
|--------|--------|----------|
| integration（多适配器） | 4 | 87ms |
| MongoDB | 497 | ~35s |
| MySQL | 481 | ~46s |
| PostgreSQL | 488 | ~40s |
| SQLite | 484 | ~8s |

**测试亮点**：

- ✅ 4 个数据库适配器（MySQL、PostgreSQL、SQLite、MongoDB）全部通过测试
- ✅ 多适配器集成测试（MySQL、SQLite、MongoDB 同时操作）
- ✅ QueryLogger 含 t、logger、debug 参数测试
- ✅ `query()` 和 `find()` 方法支持完整查询条件 API
- ✅ 30+ 种数据验证规则全部测试通过
- ✅ 完整的软删除、关联查询、事务处理等功能全部测试通过
- ✅ 无资源泄漏，长时间运行稳定

查看完整测试报告：[TEST_REPORT.md](./TEST_REPORT.md)

---

## ⚡ 性能优化

- **连接池**：自动管理数据库连接池，提高并发性能
- **查询缓存**：ORM 模型支持查询结果缓存，减少数据库查询
- **预处理语句**：所有 SQL 查询使用预处理语句，防止 SQL 注入并提高性能
- **批量操作**：支持批量创建、更新、删除操作
- **索引管理**：支持数据库索引创建和管理（MongoDB）
- **异步操作**：所有操作都是异步的，不阻塞主线程

---

## 📝 注意事项

- **服务端专用**：数据库连接是服务端功能，客户端不支持
- **统一接口**：使用适配器模式，提供统一的数据库接口，支持多种数据库后端
- **类型安全**：完整的 TypeScript 类型支持
- **依赖**：需要相应的数据库驱动（PostgreSQL、MySQL、SQLite、MongoDB）
- **跨运行时**：支持 Deno 2.5.0+ 和 Bun 1.3.0+，代码在两个环境中都经过测试
- **Bun 原生支持**：SQLiteAdapter 优先使用 Bun 原生 SQLite API，提供更好的性能
- **测试覆盖**：1,954 个测试用例，核心功能覆盖率 100%
- **真实数据库测试**：所有测试使用真实数据库实例，确保测试的真实性和可靠性

---

## 📋 变更日志

**v1.0.2** (2026-02-07) - 文档结构重组：docs/en-US/ 与 docs/zh-CN/，包含 API、FEATURES、EXAMPLES、UNIFIED-INTERFACE。

详见 [CHANGELOG-zh.md](./CHANGELOG-zh.md)。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
