# @dreamer/database 特性与使用场景

> 📖 [README](../../README.md) | [中文 README](../../README-zh.md)

---

## ✨ 特性

- **多数据库适配器**：
  - PostgreSQL 适配器（PostgreSQLAdapter）- 完全支持 PostgreSQL 14+
  - MySQL/MariaDB 适配器（MySQLAdapter）- 完全支持 MySQL 8.0+
  - SQLite 适配器（SQLiteAdapter）- 支持 SQLite 3.35.0+，优先使用 Bun 原生 API
  - MongoDB 适配器（MongoDBAdapter）- 完全支持 MongoDB 7.0+
  - 统一的数据库接口（DatabaseAdapter）- 所有适配器实现统一接口
  - 运行时切换数据库后端 - 支持动态切换数据库
  - 多数据库实例支持 - 同时使用多个数据库连接
  - 服务容器集成 - 支持依赖注入和服务容器管理

- **ORM/ODM 功能**：
  - SQLModel - 关系型数据库 ORM（PostgreSQL、MySQL、SQLite）
  - MongoModel - MongoDB ODM
  - 统一接口 - SQLModel 和 MongoModel 接口完全统一（91.7% 统一率）
  - 链式查询构建器 - 流畅的查询 API，支持 `query()` 和 `find()` 方法
  - 查询条件方法 - `query()` 支持 `where`、`orWhere`、`andWhere`、`like`、`orLike`、`andLike`；`find()` 支持 `orWhere`、`andWhere`、`orLike`、`andLike`（`find()` 不支持 `where` 和 `like`，因为已有初始条件，不应重置）
  - asArray() 方法 - 返回纯 JSON 对象数组，支持所有链式调用和聚合方法
  - 数据验证 - 30+ 种验证规则（详见验证规则章节）
  - 生命周期钩子 - beforeCreate、afterCreate、beforeUpdate、afterUpdate 等
  - 软删除支持 - 完整的软删除功能
  - 查询结果缓存 - 自动缓存查询结果
  - 关联关系 - belongsTo、hasOne、hasMany

- **查询构建器**：
  - SQLQueryBuilder - 关系型数据库查询构建器
  - MongoQueryBuilder - MongoDB 查询构建器
  - 链式 API - 流畅的链式查询语法
  - 类型安全 - 完整的 TypeScript 类型支持

- **迁移管理**：
  - MigrationManager - 数据库迁移管理工具
  - SQL 迁移支持 - PostgreSQL、MySQL、SQLite
  - MongoDB 迁移支持 - MongoDB 集合迁移
  - 迁移历史跟踪 - 自动记录迁移历史
  - 迁移回滚支持 - 支持迁移回滚

- **其他功能**：
  - 事务支持 - 基本事务、嵌套事务、保存点
  - 连接池管理 - 自动管理数据库连接池
  - 查询日志记录 - 支持日志级别过滤、慢查询检测、翻译函数 `t`、自定义 `logger`、`debug` 参数
  - 健康检查 - 数据库连接健康检查
  - 数据库初始化工具 - 支持自动初始化、配置加载
  - 预处理语句 - 防止 SQL 注入

---

## 🎯 使用场景

- **关系型数据库操作**：PostgreSQL、MySQL、SQLite 数据持久化
- **MongoDB 文档数据库操作**：MongoDB 集合操作和查询
- **ORM/ODM 开发**：使用模型进行数据库操作
- **多数据库项目**：同时使用关系型数据库和 MongoDB
- **数据库迁移**：数据库结构版本管理和迁移
- **事务处理**：复杂业务逻辑的事务支持
- **查询优化**：使用查询构建器优化查询性能
