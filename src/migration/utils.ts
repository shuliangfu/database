/**
 * 迁移工具函数
 */

import { basename, extname, mkdir, stat } from "@dreamer/runtime-adapter";

/**
 * 迁移文件模板（SQL 数据库）
 */
export const SQL_MIGRATION_TEMPLATE = `/**
 * 迁移文件
 * 生成时间: {timestamp}
 */

import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class {className} implements Migration {
  name = '{name}';

  /**
   * 执行迁移（升级）
   * @param db 数据库适配器实例
   */
  async up(db: DatabaseAdapter): Promise<void> {
    // 在此实现迁移逻辑
    // 示例：创建表
    // await db.execute(\`
    //   CREATE TABLE IF NOT EXISTS users (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     name TEXT NOT NULL,
    //     email TEXT UNIQUE NOT NULL,
    //     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    //     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    //   )
    // \`);

    // 示例：创建索引
    // await db.execute(\`
    //   CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    // \`);

    // 示例：添加列
    // await db.execute(\`
    //   ALTER TABLE users ADD COLUMN age INTEGER
    // \`);
  }

  /**
   * 回滚迁移（降级）
   * @param db 数据库适配器实例
   */
  async down(db: DatabaseAdapter): Promise<void> {
    // 在此实现回滚逻辑（与 up 方法相反的操作）
    // 示例：删除表
    // await db.execute('DROP TABLE IF EXISTS users');

    // 示例：删除索引
    // await db.execute('DROP INDEX IF EXISTS idx_users_email');

    // 示例：删除列
    // await db.execute('ALTER TABLE users DROP COLUMN age');
  }
}
`;

/**
 * 迁移文件模板（MongoDB）
 */
export const MONGO_MIGRATION_TEMPLATE = `/**
 * 迁移文件
 * 生成时间: {timestamp}
 */

import type { Migration } from '@dreamer/database';
import type { DatabaseAdapter } from '@dreamer/database';

export default class {className} implements Migration {
  name = '{name}';

  /**
   * 执行迁移（升级）
   * @param db 数据库适配器实例
   */
  async up(db: DatabaseAdapter): Promise<void> {
    // 在此实现迁移逻辑
    // 示例：创建集合
    // await db.execute('createCollection', 'users', {
    //   validator: {
    //     $jsonSchema: {
    //       bsonType: 'object',
    //       required: ['name', 'email'],
    //       properties: {
    //         name: { bsonType: 'string' },
    //         email: { bsonType: 'string' },
    //         age: { bsonType: 'int', minimum: 0 },
    //       },
    //     },
    //   },
    // });

    // 示例：创建索引
    // await db.execute('createIndex', 'users', {
    //   keys: { email: 1 },
    //   options: { unique: true },
    // });

    // 示例：插入初始数据
    // await db.execute('insertMany', 'users', [
    //   { name: 'Admin', email: 'admin@example.com', age: 30 },
    // ]);
  }

  /**
   * 回滚迁移（降级）
   * @param db 数据库适配器实例
   */
  async down(db: DatabaseAdapter): Promise<void> {
    // 在此实现回滚逻辑（与 up 方法相反的操作）
    // 示例：删除集合
    // await db.execute('dropCollection', 'users', {});

    // 示例：删除索引
    // await db.execute('dropIndex', 'users', {
    //   index: 'email_1',
    // });

    // 示例：删除数据
    // await db.execute('deleteMany', 'users', {
    //   filter: { email: 'admin@example.com' },
    // });
  }
}
`;

/**
 * 生成迁移文件名
 * @param name 迁移名称
 * @returns 迁移文件名（包含时间戳）
 */
export function generateMigrationFileName(name: string): string {
  const timestamp = Date.now();
  const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${timestamp}_${sanitizedName}.ts`;
}

/**
 * 从文件名解析迁移信息
 * @param filename 文件名
 * @returns 迁移信息（时间戳和名称）
 */
export function parseMigrationFileName(
  filename: string,
): { timestamp: number; name: string } | null {
  const baseName = basename(filename, extname(filename));
  const match = baseName.match(/^(\d+)_(.+)$/);
  if (!match) {
    return null;
  }
  return {
    timestamp: parseInt(match[1], 10),
    name: match[2],
  };
}

/**
 * 生成类名（从迁移名称）
 * @param name 迁移名称
 * @returns 类名
 */
export function generateClassName(name: string): string {
  // 将下划线或短横线分隔的名称转换为驼峰命名
  return name
    .split(/[_-]/)
    .map((part, index) => {
      if (index === 0) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

/**
 * 确保迁移目录存在
 * @param dir 目录路径
 */
export async function ensureMigrationsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * 检查文件是否存在
 * @param filepath 文件路径
 * @returns 是否存在
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    try {
      await stat(filepath);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}
