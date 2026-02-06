/**
 * @fileoverview MigrationManager MySQL 测试
 */

import {
  cwd,
  join,
  mkdir,
  readdir,
  readTextFile,
  remove,
  stat,
  writeTextFile,
} from "@dreamer/runtime-adapter";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { closeDatabase, getDatabase, initDatabase } from "../../src/access.ts";
import { MigrationManager } from "../../src/migration/manager.ts";
import type { DatabaseAdapter } from "../../src/types.ts";
import { createMysqlConfig } from "./mysql-test-utils.ts";

// 定义表名常量（使用目录名_文件名_作为前缀）
const TABLE_TEST = "mysql_migration_test_table";
const TABLE_ROLLBACK = "mysql_migration_rollback_table";
const TABLE_STATUS = "mysql_migration_status_table1";

describe("MigrationManager", () => {
  const testMigrationsDir = join(cwd(), "tests", "data", "test_migrations");
  let mysqlAdapter: DatabaseAdapter;

  beforeAll(async () => {
    // 清理测试目录
    try {
      await remove(testMigrationsDir, { recursive: true });
    } catch {
      // 目录不存在，忽略
    }
    await mkdir(testMigrationsDir, { recursive: true });

    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase(createMysqlConfig());

      // 从全局 dbManager 获取适配器
      mysqlAdapter = getDatabase();
    } catch (error) {
      console.warn(
        `MySQL not available for migration tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      mysqlAdapter = null as any;
    }
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await remove(testMigrationsDir, { recursive: true });
    } catch {
      // 忽略错误
    }
    // 使用 closeDatabase 关闭全局 dbManager 管理的所有连接
    await closeDatabase();
  });

  beforeEach(async () => {
    if (!mysqlAdapter) {
      return;
    }

    // 清理迁移历史表和所有测试表
    try {
      // 获取所有表名
      const tables = await mysqlAdapter.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME != 'migrations'",
        [],
      );
      for (const table of tables) {
        try {
          await mysqlAdapter.execute(
            `DROP TABLE IF EXISTS ${table.TABLE_NAME}`,
            [],
          );
        } catch {
          // 忽略错误
        }
      }
      // 清理 migrations 表数据
      try {
        const tableExists = await mysqlAdapter.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'migrations'",
          [],
        );
        if (tableExists.length > 0) {
          await mysqlAdapter.execute("TRUNCATE TABLE migrations", []);
        }
      } catch {
        // 表不存在或查询失败，忽略
      }
    } catch {
      // 忽略错误
    }
  });

  afterEach(async () => {
    // 测试完成后清理迁移文件目录
    try {
      const files = await readdir(testMigrationsDir);
      for (const file of files) {
        if (file.isFile && file.name.endsWith(".ts")) {
          try {
            await remove(join(testMigrationsDir, file.name));
          } catch {
            // 忽略错误
          }
        }
      }
    } catch {
      // 目录不存在，忽略
    }
  });

  describe("create", () => {
    it("应该创建 SQL 迁移文件", async () => {
      if (!mysqlAdapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mysqlAdapter,
      });

      const filepath = await manager.create("create_users_table");

      expect(filepath).toContain("create_users_table");
      expect(filepath).toContain(".ts");

      // 检查文件是否存在
      const fileStat = await stat(filepath);
      expect(fileStat.isFile).toBe(true);

      // 检查文件内容
      const content = await readTextFile(filepath);
      expect(content).toContain("create_users_table");
      expect(content).toContain("class CreateUsersTable");
      expect(content).toContain("async up");
      expect(content).toContain("async down");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });

    it("应该自动从适配器获取数据库类型", async () => {
      if (!mysqlAdapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mysqlAdapter,
      });

      const filepath = await manager.create("auto_detect_type");

      const content = await readTextFile(filepath);
      // MySQL 适配器应该生成 SQL 模板
      expect(content).toContain("CREATE TABLE IF NOT EXISTS");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("up", () => {
    it("应该执行待执行的迁移", async () => {
      if (!mysqlAdapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mysqlAdapter,
      });

      const migrationName = `test_migration_${Date.now()}`;
      const migrationFile = await manager.create(migrationName);
      // 等待文件创建完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      const migrationContent =
        `import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class TestMigration implements Migration {
  name = '${migrationName}';

  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute('CREATE TABLE IF NOT EXISTS ${TABLE_TEST} (id INT AUTO_INCREMENT PRIMARY KEY)', []);
  }

  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS ${TABLE_TEST}', []);
  }
}`;

      await writeTextFile(migrationFile, migrationContent);
      // 文件写入后需要等待文件系统同步
      await new Promise((resolve) => setTimeout(resolve, 200));

      await manager.up();

      // 验证迁移被记录到历史表
      const migrations = await mysqlAdapter.query(
        "SELECT * FROM migrations WHERE name = ?",
        [migrationName],
      );
      expect(migrations.length).toBe(1);

      // 验证表已创建
      const tables = await mysqlAdapter.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${TABLE_TEST}'`,
        [],
      );
      expect(tables.length).toBe(1);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("down", () => {
    it("应该回滚最近的迁移", async () => {
      if (!mysqlAdapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mysqlAdapter,
      });

      const migrationName = `rollback_test_${Date.now()}`;
      const migrationFile = await manager.create(migrationName);

      const migrationContent =
        `import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class RollbackTest implements Migration {
  name = '${migrationName}';

  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute('CREATE TABLE IF NOT EXISTS ${TABLE_ROLLBACK} (id INT AUTO_INCREMENT PRIMARY KEY)', []);
  }

  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS ${TABLE_ROLLBACK}', []);
  }
}`;

      await writeTextFile(migrationFile, migrationContent);
      // 文件写入后需要等待文件系统同步
      await new Promise((resolve) => setTimeout(resolve, 200));

      await manager.up();

      // 验证表已创建
      const tablesBefore = await mysqlAdapter.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${TABLE_ROLLBACK}'`,
        [],
      );
      expect(tablesBefore.length).toBe(1);

      // 回滚迁移
      await manager.down(1);

      // 验证表已被删除
      const tablesAfter = await mysqlAdapter.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${TABLE_ROLLBACK}'`,
        [],
      );
      expect(tablesAfter.length).toBe(0);

      // 验证迁移记录已删除
      const migrations = await mysqlAdapter.query(
        "SELECT * FROM migrations WHERE name = ?",
        [migrationName],
      );
      expect(migrations.length).toBe(0);
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("status", () => {
    it("应该返回所有迁移的状态", async () => {
      if (!mysqlAdapter) {
        console.log("MySQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mysqlAdapter,
      });

      const timestamp = Date.now();
      const migration1Name = `status_test_1_${timestamp}`;
      const migration2Name = `status_test_2_${timestamp}`;

      const migration1File = await manager.create(migration1Name);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const migration2File = await manager.create(migration2Name);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const migration1Content =
        `import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class StatusTest1 implements Migration {
  name = '${migration1Name}';
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute('CREATE TABLE IF NOT EXISTS ${TABLE_STATUS} (id INT AUTO_INCREMENT PRIMARY KEY)', []);
  }
  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS ${TABLE_STATUS}', []);
  }
}`;
      await writeTextFile(migration1File, migration1Content);

      await manager.up(1);

      const statuses = await manager.status();

      expect(statuses.length).toBeGreaterThanOrEqual(2);

      const status1 = statuses.find((s) => s.name === migration1Name);
      expect(status1).toBeTruthy();
      expect(status1?.executed).toBe(true);

      const status2 = statuses.find((s) => s.name === migration2Name);
      expect(status2).toBeTruthy();
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
