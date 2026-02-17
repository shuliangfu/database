# 变更日志

本文档记录 @dreamer/database 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
