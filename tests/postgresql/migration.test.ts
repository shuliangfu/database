/**
 * @fileoverview MigrationManager PostgreSQL 测试
 */

import {
  cwd,
  getEnv,
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

/**
 * 获取环境变量，带默认值
 */
function getEnvWithDefault(key: string, defaultValue: string = ""): string {
  return getEnv(key) || defaultValue;
}

describe("MigrationManager", () => {
  const testMigrationsDir = join(cwd(), "tests", "data", "test_migrations");
  let postgresAdapter: DatabaseAdapter;

  beforeAll(async () => {
    // 清理测试目录
    try {
      await remove(testMigrationsDir, { recursive: true });
    } catch {
      // 目录不存在，忽略
    }
    await mkdir(testMigrationsDir, { recursive: true });

    const pgHost = getEnvWithDefault("POSTGRES_HOST", "localhost");
    const pgPort = parseInt(getEnvWithDefault("POSTGRES_PORT", "5432"));
    const pgDatabase = getEnvWithDefault("POSTGRES_DATABASE", "postgres");
    const defaultUser = getEnv("USER") || getEnv("USERNAME") || "postgres";
    const pgUser = getEnvWithDefault("POSTGRES_USER", defaultUser);
    const pgPassword = getEnvWithDefault("POSTGRES_PASSWORD", "");

    try {
      // 使用 initDatabase 初始化全局 dbManager
      await initDatabase({
        type: "postgresql",
        connection: {
          host: pgHost,
          port: pgPort,
          database: pgDatabase,
          username: pgUser,
          password: pgPassword,
        },
      });

      // 从全局 dbManager 获取适配器
      postgresAdapter = getDatabase();
    } catch (error) {
      console.warn(
        `PostgreSQL not available for migration tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      postgresAdapter = null as any;
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
    if (!postgresAdapter) {
      return;
    }

    // 清理迁移历史表和所有测试表
    try {
      // 获取所有表名
      const tables = await postgresAdapter.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'",
        [],
      );
      for (const table of tables) {
        try {
          await postgresAdapter.execute(
            `DROP TABLE IF EXISTS ${table.tablename} CASCADE`,
            [],
          );
        } catch {
          // 忽略错误
        }
      }
      // 清理 migrations 表数据
      try {
        const tableExists = await postgresAdapter.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migrations'",
          [],
        );
        if (tableExists.length > 0) {
          await postgresAdapter.execute(
            "TRUNCATE TABLE migrations RESTART IDENTITY",
            [],
          );
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
      if (typeof (globalThis as any).Bun !== "undefined") {
      }
    } catch {
      // 目录不存在，忽略
    }
  });

  describe("create", () => {
    it("应该创建 SQL 迁移文件", async () => {
      if (!postgresAdapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: postgresAdapter,
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
      if (!postgresAdapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: postgresAdapter,
      });

      const filepath = await manager.create("auto_detect_type");

      const content = await readTextFile(filepath);
      // PostgreSQL 适配器应该生成 SQL 模板
      expect(content).toContain("CREATE TABLE IF NOT EXISTS");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("up", () => {
    it("应该执行待执行的迁移", async () => {
      if (!postgresAdapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: postgresAdapter,
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
    await db.execute('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY)', []);
  }

  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS test_table', []);
  }
}`;

      await writeTextFile(migrationFile, migrationContent);
      // 文件写入后需要等待文件系统同步
      await new Promise((resolve) => setTimeout(resolve, 200));

      await manager.up();

      // 验证迁移被记录到历史表
      const migrations = await postgresAdapter.query(
        "SELECT * FROM migrations WHERE name = $1",
        [migrationName],
      );
      expect(migrations.length).toBe(1);

      // 验证表已创建
      const tables = await postgresAdapter.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_table'",
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
      if (!postgresAdapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: postgresAdapter,
      });

      const migrationName = `rollback_test_${Date.now()}`;
      const migrationFile = await manager.create(migrationName);

      const migrationContent =
        `import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class RollbackTest implements Migration {
  name = '${migrationName}';

  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute('CREATE TABLE IF NOT EXISTS rollback_table (id SERIAL PRIMARY KEY)', []);
  }

  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS rollback_table', []);
  }
}`;

      await writeTextFile(migrationFile, migrationContent);
      // 文件写入后需要等待文件系统同步
      await new Promise((resolve) => setTimeout(resolve, 200));

      await manager.up();

      // 验证表已创建
      const tablesBefore = await postgresAdapter.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rollback_table'",
        [],
      );
      expect(tablesBefore.length).toBe(1);

      // 回滚迁移
      await manager.down(1);

      // 验证表已被删除
      const tablesAfter = await postgresAdapter.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rollback_table'",
        [],
      );
      expect(tablesAfter.length).toBe(0);

      // 验证迁移记录已删除
      const migrations = await postgresAdapter.query(
        "SELECT * FROM migrations WHERE name = $1",
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
      if (!postgresAdapter) {
        console.log("PostgreSQL not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: postgresAdapter,
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
    await db.execute('CREATE TABLE IF NOT EXISTS status_table1 (id SERIAL PRIMARY KEY)', []);
  }
  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS status_table1', []);
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
