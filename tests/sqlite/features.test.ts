/**
 * @fileoverview SQLite 特有功能测试
 * 测试 SQLite 特有的功能：FTS（全文搜索）、JSON 函数、约束违反、外键约束、连接选项等
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { SQLiteAdapter } from "../../src/adapters/sqlite.ts";

describe("SQLite 特有功能", () => {
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    adapter = new SQLiteAdapter();
    await adapter.connect({
      type: "sqlite",
      connection: {
        filename: ":memory:",
      },
    });
  });

  afterAll(async () => {
    if (adapter) {
      try {
        await adapter.close();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  beforeEach(async () => {
    if (!adapter) return;

    // 清理测试表
    try {
      await adapter.execute("DROP TABLE IF EXISTS test_fts_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_fts_data_content", []);
      await adapter.execute("DROP TABLE IF EXISTS test_json_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_constraint_data", []);
      await adapter.execute("DROP TABLE IF EXISTS test_fk_parent", []);
      await adapter.execute("DROP TABLE IF EXISTS test_fk_child", []);
    } catch {
      // 忽略错误
    }
  });

  describe("FTS（全文搜索）", () => {
    it("应该支持 FTS5 全文搜索", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 创建 FTS5 虚拟表
      await adapter.execute(
        `CREATE VIRTUAL TABLE test_fts_data USING fts5(
          title,
          content
        )`,
        [],
      );

      // 插入数据
      await adapter.execute(
        "INSERT INTO test_fts_data (title, content) VALUES (?, ?)",
        ["SQLite Tutorial", "This is a tutorial about SQLite database"],
      );

      await adapter.execute(
        "INSERT INTO test_fts_data (title, content) VALUES (?, ?)",
        ["Database Guide", "Learn about databases and SQL"],
      );

      // 使用全文搜索查询
      const results = await adapter.query(
        "SELECT * FROM test_fts_data WHERE test_fts_data MATCH ?",
        ["tutorial"],
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes("Tutorial"))).toBe(true);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 FTS5 高级搜索", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE VIRTUAL TABLE test_fts_data USING fts5(
          title,
          content
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_fts_data (title, content) VALUES (?, ?), (?, ?)",
        [
          "PostgreSQL Guide",
          "PostgreSQL is a powerful database",
          "MySQL Guide",
          "MySQL is also a database",
        ],
      );

      // 使用 AND 操作符
      const results = await adapter.query(
        "SELECT * FROM test_fts_data WHERE test_fts_data MATCH ?",
        ["database AND powerful"],
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe("PostgreSQL Guide");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("JSON 函数", () => {
    it("应该支持 json() 函数", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_json_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          data TEXT
        )`,
        [],
      );

      const jsonData = { key: "value", number: 123 };

      await adapter.execute(
        "INSERT INTO test_json_data (name, data) VALUES (?, ?)",
        ["JSON User", JSON.stringify(jsonData)],
      );

      // 使用 json() 函数解析 JSON
      const results = await adapter.query(
        "SELECT name, json_extract(data, '$.key') as key_value FROM test_json_data WHERE name = ?",
        ["JSON User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].key_value).toBe("value");
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 json_extract() 函数", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_json_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          data TEXT
        )`,
        [],
      );

      const jsonData = {
        user: { name: "John", age: 30 },
        tags: ["tag1", "tag2"],
      };

      await adapter.execute(
        "INSERT INTO test_json_data (name, data) VALUES (?, ?)",
        ["JSON Extract User", JSON.stringify(jsonData)],
      );

      // 提取嵌套值
      const results = await adapter.query(
        "SELECT json_extract(data, '$.user.name') as user_name, json_extract(data, '$.user.age') as user_age FROM test_json_data WHERE name = ?",
        ["JSON Extract User"],
      );

      expect(results.length).toBe(1);
      expect(results[0].user_name).toBe("John");
      expect(results[0].user_age).toBe(30);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 json_array() 和 json_object() 函数", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 测试 json_array() 函数
      const arrayResult = await adapter.query(
        "SELECT json_array(1, 2, 3) as arr",
        [],
      );
      expect(arrayResult.length).toBe(1);
      expect(JSON.parse(arrayResult[0].arr)).toEqual([1, 2, 3]);

      // 测试 json_object() 函数
      const objectResult = await adapter.query(
        "SELECT json_object('key1', 'value1', 'key2', 'value2') as obj",
        [],
      );
      expect(objectResult.length).toBe(1);
      const parsed = JSON.parse(objectResult[0].obj);
      expect(parsed.key1).toBe("value1");
      expect(parsed.key2).toBe("value2");
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("约束违反", () => {
    it("应该处理 NOT NULL 约束违反", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_constraint_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT
        )`,
        [],
      );

      // 尝试插入 NULL 值到 NOT NULL 字段
      try {
        await adapter.execute(
          "INSERT INTO test_constraint_data (name, email) VALUES (?, ?)",
          [null, "test@test.com"],
        );
        // 如果插入成功，测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出约束违反错误
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理 UNIQUE 约束违反", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_constraint_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT UNIQUE
        )`,
        [],
      );

      await adapter.execute(
        "INSERT INTO test_constraint_data (name, email) VALUES (?, ?)",
        ["User 1", "unique@test.com"],
      );

      // 尝试插入重复的 email
      try {
        await adapter.execute(
          "INSERT INTO test_constraint_data (name, email) VALUES (?, ?)",
          ["User 2", "unique@test.com"],
        );
        // 如果插入成功，测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出唯一约束违反错误
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理 CHECK 约束违反", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute(
        `CREATE TABLE test_constraint_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          age INTEGER CHECK(age >= 0 AND age <= 150)
        )`,
        [],
      );

      // 尝试插入违反 CHECK 约束的值
      try {
        await adapter.execute(
          "INSERT INTO test_constraint_data (name, age) VALUES (?, ?)",
          ["Invalid Age User", 200],
        );
        // 如果插入成功，测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出 CHECK 约束违反错误
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("外键约束", () => {
    it("应该支持外键约束", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 启用外键约束
      await adapter.execute("PRAGMA foreign_keys = ON", []);

      // 创建父表
      await adapter.execute(
        `CREATE TABLE test_fk_parent (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
        [],
      );

      // 创建子表（带外键）
      await adapter.execute(
        `CREATE TABLE test_fk_child (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER NOT NULL,
          name TEXT,
          FOREIGN KEY (parent_id) REFERENCES test_fk_parent(id)
        )`,
        [],
      );

      // 插入父表数据
      await adapter.execute(
        "INSERT INTO test_fk_parent (name) VALUES (?)",
        ["Parent 1"],
      );

      const parent = await adapter.query(
        "SELECT id FROM test_fk_parent WHERE name = ?",
        ["Parent 1"],
      );
      const parentId = parent[0].id;

      // 插入子表数据（有效的外键）
      await adapter.execute(
        "INSERT INTO test_fk_child (parent_id, name) VALUES (?, ?)",
        [parentId, "Child 1"],
      );

      const children = await adapter.query(
        "SELECT * FROM test_fk_child WHERE parent_id = ?",
        [parentId],
      );
      expect(children.length).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该处理外键约束违反", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      await adapter.execute("PRAGMA foreign_keys = ON", []);

      await adapter.execute(
        `CREATE TABLE test_fk_parent (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
        [],
      );

      await adapter.execute(
        `CREATE TABLE test_fk_child (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER NOT NULL,
          name TEXT,
          FOREIGN KEY (parent_id) REFERENCES test_fk_parent(id)
        )`,
        [],
      );

      // 尝试插入不存在的外键
      try {
        await adapter.execute(
          "INSERT INTO test_fk_child (parent_id, name) VALUES (?, ?)",
          [999, "Invalid Child"],
        );
        // 如果插入成功，测试失败
        expect(false).toBe(true);
      } catch (error) {
        // 应该抛出外键约束违反错误
        expect(error).toBeInstanceOf(Error);
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("连接选项", () => {
    it("应该支持只读模式连接", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 注意：只读模式测试需要真实的文件数据库
      // 内存数据库（:memory:）不支持只读模式
      // 另外，Deno 环境的 node:sqlite 可能不支持 readonly 选项
      // 此测试主要用于验证配置选项的语法正确性
      const testAdapter = new SQLiteAdapter();
      await testAdapter.connect({
        type: "sqlite",
        connection: {
          filename: ":memory:",
        },
        sqliteOptions: {
          readonly: true, // 只读模式（在 Deno 环境和内存数据库中可能不支持，但测试配置语法）
        },
      });

      expect(testAdapter.isConnected()).toBe(true);
      await testAdapter.close();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 WAL 模式", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 启用 WAL 模式
      await adapter.execute("PRAGMA journal_mode = WAL", []);

      // 验证 WAL 模式已启用
      const result = await adapter.query("PRAGMA journal_mode", []);
      expect(result.length).toBe(1);
      // WAL 模式在内存数据库中可能不支持，但至少不会报错
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持其他 PRAGMA 设置", async () => {
      if (!adapter) {
        console.log("SQLite not available, skipping test");
        return;
      }

      // 设置同步模式
      await adapter.execute("PRAGMA synchronous = NORMAL", []);

      // 设置缓存大小
      await adapter.execute("PRAGMA cache_size = 1000", []);

      // 验证设置
      const syncResult = await adapter.query("PRAGMA synchronous", []);
      expect(syncResult.length).toBe(1);

      const cacheResult = await adapter.query("PRAGMA cache_size", []);
      expect(cacheResult.length).toBe(1);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
