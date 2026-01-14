/**
 * @fileoverview MigrationManager MongoDB 测试
 */

import {
  cwd,
  join,
  mkdir,
  readdir,
  readTextFile,
  remove,
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
import { MongoDBAdapter } from "../../src/adapters/mongodb.ts";
import { MigrationManager } from "../../src/migration/manager.ts";
import type { DatabaseAdapter } from "../../src/types.ts";

describe("MigrationManager", () => {
  const testMigrationsDir = join(cwd(), "tests", "data", "test_migrations");
  let mongoAdapter: DatabaseAdapter;

  beforeAll(async () => {
    // 清理测试目录
    try {
      await remove(testMigrationsDir, { recursive: true });
    } catch {
      // 目录不存在，忽略
    }
    await mkdir(testMigrationsDir, { recursive: true });

    // 创建真实的 MongoDB 适配器
    mongoAdapter = new MongoDBAdapter();
    try {
      await mongoAdapter.connect({
        type: "mongodb",
        connection: {
          host: "localhost",
          port: 27017,
          database: "test_migrations",
        },
        mongoOptions: {
          replicaSet: "rs0",
          directConnection: true,
        },
      });
    } catch (error) {
      // MongoDB 不可用，设置为 null，测试中会跳过 MongoDB 相关测试
      console.warn(
        `MongoDB not available for migration tests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      mongoAdapter = null as any;
    }
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await remove(testMigrationsDir, { recursive: true });
    } catch {
      // 忽略错误
    }
    await mongoAdapter?.close();
  });

  beforeEach(async () => {
    try {
      const db = (mongoAdapter as any).db;
      if (db) {
        // 获取所有集合名
        const collections = await db.listCollections().toArray();
        for (const coll of collections) {
          if (coll.name !== "test_migrations" && coll.name !== "migrations") {
            try {
              await db.collection(coll.name).drop();
            } catch {
              // 忽略错误
            }
          }
        }
        // 清理迁移历史集合数据
        try {
          await db.collection("test_migrations").deleteMany({});
          await db.collection("migrations").deleteMany({});
        } catch {
          // 集合不存在，忽略
        }
      }
    } catch {
      // 忽略错误
    }
  });

  afterEach(async () => {
    // 测试完成后清理迁移文件目录
    // 这样可以确保测试执行过程中文件不会被删除
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
      // 在 Bun 中，删除文件后需要等待文件系统同步
      if (typeof (globalThis as any).Bun !== "undefined") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch {
      // 目录不存在，忽略
    }
  });

  describe("create", () => {
    it("应该创建 MongoDB 迁移文件", async () => {
      if (!mongoAdapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mongoAdapter,
      });

      const filepath = await manager.create(
        "create_users_collection",
        "mongodb",
      );

      expect(filepath).toContain("create_users_collection");
      expect(filepath).toContain(".ts");

      // 检查文件内容
      const content = await readTextFile(filepath);
      expect(content).toContain("createCollection");
      expect(content).toContain("dropCollection");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });

  describe("MongoDB 适配器支持", () => {
    it("应该为 MongoDB 创建迁移历史集合", async () => {
      if (!mongoAdapter) {
        console.log("MongoDB not available, skipping test");
        return;
      }

      const manager = new MigrationManager({
        migrationsDir: testMigrationsDir,
        adapter: mongoAdapter,
        historyCollectionName: "test_migrations",
      });

      // 创建并执行迁移
      const migrationFile = await manager.create("mongo_test", "mongodb");

      // 等待 manager.create 创建的文件系统同步
      await new Promise((resolve) => setTimeout(resolve, 100));

      const migrationContent =
        `import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class MongoTest implements Migration {
  name = 'mongo_test';
  async up(db: DatabaseAdapter): Promise<void> {
    // 使用 MongoDB 适配器的 getDatabase 方法
    const mongoDb = (db as any).getDatabase();
    await mongoDb.createCollection('test_collection');
  }
  async down(db: DatabaseAdapter): Promise<void> {
    const mongoDb = (db as any).getDatabase();
    await mongoDb.collection('test_collection').drop();
  }
}`;
      await writeTextFile(migrationFile, migrationContent);

      // 在 Bun 中，文件写入后需要等待文件系统同步
      // 确保文件可以被模块系统识别
      // 增加等待时间，确保文件系统完全同步
      if (typeof (globalThis as any).Bun !== "undefined") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 执行迁移以触发历史集合创建
      await manager.up();

      // 验证迁移记录已创建
      const db = (mongoAdapter as any).db;
      const migrations = await db.collection("test_migrations").find({})
        .toArray();
      expect(migrations.length).toBe(1);
      expect(migrations[0].name).toBe("mongo_test");
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
