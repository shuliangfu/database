/**
 * 迁移管理器
 * 负责迁移文件的生成、执行和回滚
 */

import { $tr } from "../i18n.ts";
import { createLogger } from "@dreamer/logger";
import {
  basename,
  cwd,
  IS_BUN,
  join,
  readdir,
  realPath,
  stat,
  writeTextFile,
} from "@dreamer/runtime-adapter";
import type { DatabaseType } from "../types.ts";
import type { Migration, MigrationConfig, MigrationStatus } from "./types.ts";
import {
  ensureMigrationsDir,
  generateClassName,
  generateMigrationFileName,
  MONGO_MIGRATION_TEMPLATE,
  parseMigrationFileName,
  SQL_MIGRATION_TEMPLATE,
} from "./utils.ts";

/**
 * 迁移管理器类
 */
export class MigrationManager {
  private config: MigrationConfig;
  private historyTableName: string;
  private historyCollectionName: string;

  /** 日志记录器（使用传入的 logger 或默认 createLogger） */
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };

  constructor(config: MigrationConfig) {
    this.config = config;
    this.historyTableName = config.historyTableName || "migrations";
    this.historyCollectionName = config.historyCollectionName || "migrations";
    const ext = config.logger;
    const def = createLogger({
      level: "info",
      format: "text",
      tags: ["database", "migration"],
    });
    this.logger = {
      info: (msg) => ext?.info?.(msg) ?? def.info(msg),
      warn: (msg) => ext?.warn?.(msg) ?? def.warn(msg),
      error: (msg) => ext?.error?.(msg) ?? def.error(msg),
      debug: (msg) => ext?.debug?.(msg) ?? def.debug(msg),
    };
  }

  /**
   * 初始化迁移历史表/集合
   */
  private async ensureHistoryTable(): Promise<void> {
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    if (dbAdapter === "mongodb") {
      // MongoDB: 检查集合是否存在，不存在则创建
      try {
        await (db as any).query(this.historyCollectionName, {}, { limit: 1 });
        // 如果查询成功，说明集合已存在
      } catch {
        // 集合不存在，创建它
        await (db as any).execute(
          "createCollection",
          this.historyCollectionName,
          {},
        );
      }
    } else {
      // SQL 数据库: 创建迁移历史表
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.historyTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          batch INTEGER NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      try {
        await db.execute(createTableSQL, []);
      } catch (error) {
        // 某些数据库可能需要不同的 SQL 语法
        // PostgreSQL/MySQL 使用不同的语法
        if (dbAdapter === "postgresql" || dbAdapter === "mysql") {
          const pgCreateTableSQL = `
            CREATE TABLE IF NOT EXISTS ${this.historyTableName} (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL UNIQUE,
              batch INTEGER NOT NULL,
              executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `;
          await db.execute(pgCreateTableSQL, []);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 获取已执行的迁移列表
   */
  private async getExecutedMigrations(): Promise<string[]> {
    await this.ensureHistoryTable();
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    if (dbAdapter === "mongodb") {
      const results = await (db as any).query(
        this.historyCollectionName,
        {},
        {},
      );
      return results.map((r: any) => r.name as string);
    } else {
      const results = await db.query(
        `SELECT name FROM ${this.historyTableName} ORDER BY executed_at ASC`,
        [],
      );
      return results.map((r: any) => r.name as string);
    }
  }

  /**
   * 记录迁移执行
   */
  private async recordMigration(name: string, batch: number): Promise<void> {
    await this.ensureHistoryTable();
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    if (dbAdapter === "mongodb") {
      await (db as any).execute("insert", this.historyCollectionName, {
        name,
        batch,
        executedAt: new Date(),
      });
    } else {
      await db.execute(
        `INSERT INTO ${this.historyTableName} (name, batch) VALUES (?, ?)`,
        [name, batch],
      );
    }
  }

  /**
   * 删除迁移记录
   */
  private async removeMigrationRecord(name: string): Promise<void> {
    await this.ensureHistoryTable();
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    if (dbAdapter === "mongodb") {
      await (db as any).execute("delete", this.historyCollectionName, {
        filter: { name },
      });
    } else {
      await db.execute(`DELETE FROM ${this.historyTableName} WHERE name = ?`, [
        name,
      ]);
    }
  }

  /**
   * 获取下一个批次号
   */
  private async getNextBatch(): Promise<number> {
    await this.ensureHistoryTable();
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    if (dbAdapter === "mongodb") {
      const results = await (db as any).query(
        this.historyCollectionName,
        {},
        { sort: { batch: -1 }, limit: 1 },
      );
      if (results.length === 0) {
        return 1;
      }
      return ((results[0] as any).batch || 0) + 1;
    } else {
      const results = await db.query(
        `SELECT MAX(batch) as max_batch FROM ${this.historyTableName}`,
        [],
      );
      if (results.length === 0 || !results[0].max_batch) {
        return 1;
      }
      return (results[0] as any).max_batch + 1;
    }
  }

  /**
   * 创建迁移文件
   * @param name 迁移名称
   * @param dbAdapter 数据库适配器（可选，用于选择模板）
   * @returns 创建的迁移文件路径
   */
  async create(
    name: string,
    dbAdapter?: DatabaseType,
  ): Promise<string> {
    await ensureMigrationsDir(this.config.migrationsDir);

    const filename = generateMigrationFileName(name);
    const filepath = join(this.config.migrationsDir, filename);
    const className = generateClassName(name);

    // 如果未指定数据库适配器，尝试从适配器配置获取
    if (!dbAdapter) {
      dbAdapter = (this.config.adapter as any).config?.adapter as
        | DatabaseType
        | undefined;
    }

    // 根据数据库适配器选择模板
    const template = dbAdapter === "mongodb"
      ? MONGO_MIGRATION_TEMPLATE
      : SQL_MIGRATION_TEMPLATE;

    const content = template
      .replace(/{timestamp}/g, new Date().toISOString())
      .replace(/{className}/g, className)
      .replace(/{name}/g, name);

    await writeTextFile(filepath, content);
    return filepath;
  }

  /**
   * 加载迁移文件
   */
  private async loadMigration(filepath: string): Promise<Migration> {
    // 动态导入迁移文件
    // 需要将路径转换为正确的格式，并解析真实路径（处理符号链接等）
    let moduleUrl: string;
    let statPath: string;
    try {
      // 解析真实路径（处理符号链接等）
      const resolvedPath = await realPath(filepath);

      if (IS_BUN) {
        // Bun 可以直接使用绝对路径（不带 file:// 协议）
        // 确保路径格式正确（处理 Windows 路径）
        let normalizedPath = resolvedPath;
        if (normalizedPath.startsWith("file://")) {
          normalizedPath = normalizedPath.slice(7);
        }
        // Windows 路径需要特殊处理（C:\ -> C:/）
        if (normalizedPath.match(/^[A-Za-z]:/)) {
          normalizedPath = normalizedPath.replace(/\\/g, "/");
        }
        // Bun 可以直接使用绝对路径
        moduleUrl = normalizedPath;
        // Bun 中 stat 和 import 都使用相同的路径
        statPath = moduleUrl;
      } else {
        // Deno 使用 file:// URL
        if (resolvedPath.startsWith("file://")) {
          moduleUrl = resolvedPath;
        } else if (
          resolvedPath.startsWith("/") || resolvedPath.match(/^[A-Za-z]:/)
        ) {
          // 绝对路径（Unix 或 Windows）
          moduleUrl = `file://${resolvedPath}`;
        } else {
          // 相对路径，需要加上当前工作目录
          moduleUrl = `file://${cwd()}/${resolvedPath}`;
        }
        // Deno 中 stat 需要文件系统路径，import 需要 file:// URL
        statPath = moduleUrl.startsWith("file://")
          ? moduleUrl.slice(7)
          : moduleUrl;
      }
    } catch {
      // 如果 realPath 失败，直接使用原始路径
      if (IS_BUN) {
        // Bun: 直接使用绝对路径（不带 file:// 协议）
        let normalizedPath = filepath;
        if (normalizedPath.startsWith("file://")) {
          normalizedPath = normalizedPath.slice(7);
        }
        // Windows 路径需要特殊处理
        if (normalizedPath.match(/^[A-Za-z]:/)) {
          normalizedPath = normalizedPath.replace(/\\/g, "/");
        }
        // Bun 可以直接使用绝对路径
        moduleUrl = normalizedPath;
        statPath = moduleUrl;
      } else {
        // Deno: 使用 file:// URL
        if (filepath.startsWith("file://")) {
          moduleUrl = filepath;
        } else if (filepath.startsWith("/") || filepath.match(/^[A-Za-z]:/)) {
          // 绝对路径
          moduleUrl = `file://${filepath}`;
        } else {
          // 相对路径，需要加上当前工作目录
          moduleUrl = `file://${cwd()}/${filepath}`;
        }
        // Deno 中 stat 需要文件系统路径
        statPath = moduleUrl.startsWith("file://")
          ? moduleUrl.slice(7)
          : moduleUrl;
      }
    }

    // 验证文件是否存在
    const fileStat = await stat(statPath);
    if (!fileStat.isFile) {
      throw new Error($tr("migration.pathNotFile", { path: moduleUrl }));
    }

    // 导入迁移文件
    const module = await import(moduleUrl);
    if (!module.default) {
      throw new Error($tr("migration.noDefaultExport", { file: filepath }));
    }
    const MigrationClass = module.default;
    return new MigrationClass() as Migration;
  }

  /**
   * 获取所有迁移文件
   */
  private async getMigrationFiles(): Promise<string[]> {
    try {
      await stat(this.config.migrationsDir);
    } catch {
      return [];
    }

    const files: string[] = [];
    const entries = await readdir(this.config.migrationsDir);
    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        files.push(join(this.config.migrationsDir, entry.name));
      }
    }

    return files.sort();
  }

  /**
   * 执行迁移（升级）
   * @param count 要执行的迁移数量（可选，不提供则执行所有待执行的迁移）
   */
  async up(count?: number): Promise<void> {
    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();
    const pending: string[] = [];

    for (const file of files) {
      const info = parseMigrationFileName(basename(file));
      if (!info) {
        continue;
      }
      if (!executed.includes(info.name)) {
        pending.push(file);
      }
    }

    if (pending.length === 0) {
      this.logger.info($tr("migration.noPending"));
      return;
    }

    const toRun = count ? pending.slice(0, count) : pending;
    const batch = await this.getNextBatch();

    for (const file of toRun) {
      const info = parseMigrationFileName(basename(file));
      if (!info) {
        continue;
      }

      try {
        this.logger.info($tr("migration.running", { name: info.name }));
        const migration = await this.loadMigration(file);
        await migration.up(this.config.adapter);
        await this.recordMigration(info.name, batch);
        this.logger.info($tr("migration.completed", { name: info.name }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          $tr("migration.migrationFailed", { name: info.name, error: message }),
        );
      }
    }
  }

  /**
   * 回滚迁移（降级）
   * @param count 要回滚的迁移数量（可选，默认为 1）
   */
  async down(count: number = 1): Promise<void> {
    const executed = await this.getExecutedMigrations();
    if (executed.length === 0) {
      this.logger.info($tr("migration.noRollback"));
      return;
    }

    const files = await this.getMigrationFiles();
    const executedFiles: Array<{ file: string; name: string }> = [];

    for (const file of files) {
      const info = parseMigrationFileName(basename(file));
      if (!info) {
        continue;
      }
      if (executed.includes(info.name)) {
        executedFiles.push({ file, name: info.name });
      }
    }

    // 按时间戳倒序排列（最新的在前）
    executedFiles.sort((a, b) => {
      const aInfo = parseMigrationFileName(basename(a.file));
      const bInfo = parseMigrationFileName(basename(b.file));
      if (!aInfo || !bInfo) {
        return 0;
      }
      return bInfo.timestamp - aInfo.timestamp;
    });

    const toRollback = executedFiles.slice(0, count);

    for (const { file, name } of toRollback) {
      try {
        this.logger.info($tr("migration.rollingBack", { name }));
        const migration = await this.loadMigration(file);
        await migration.down(this.config.adapter);
        await this.removeMigrationRecord(name);
        this.logger.info($tr("migration.rolledBack", { name }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          $tr("migration.rollbackFailed", { name, error: message }),
        );
      }
    }
  }

  /**
   * 获取迁移状态
   */
  async status(): Promise<MigrationStatus[]> {
    await this.ensureHistoryTable();
    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();
    const db = this.config.adapter;
    const dbAdapter = (db as any).config?.adapter as DatabaseType | undefined;

    if (!dbAdapter) {
      throw new Error($tr("migration.cannotDetermineType"));
    }

    // 获取已执行迁移的详细信息（包括执行时间和批次号）
    const executedDetails = new Map<
      string,
      { executedAt: Date; batch: number }
    >();

    if (dbAdapter === "mongodb") {
      const results = await (db as any).query(
        this.historyCollectionName,
        {},
        {},
      );
      for (const record of results) {
        executedDetails.set(record.name, {
          executedAt: record.executedAt
            ? new Date(record.executedAt)
            : new Date(),
          batch: record.batch || 0,
        });
      }
    } else {
      const results = await db.query(
        `SELECT name, executed_at, batch FROM ${this.historyTableName}`,
        [],
      );
      for (const record of results) {
        executedDetails.set(record.name, {
          executedAt: record.executed_at
            ? new Date(record.executed_at)
            : new Date(),
          batch: record.batch || 0,
        });
      }
    }

    const statuses: MigrationStatus[] = [];

    for (const file of files) {
      const info = parseMigrationFileName(basename(file));
      if (!info) {
        continue;
      }

      const isExecuted = executed.includes(info.name);
      const details = executedDetails.get(info.name);

      statuses.push({
        name: info.name,
        file: basename(file),
        executed: isExecuted,
        executedAt: details?.executedAt,
        batch: details?.batch,
      });
    }

    return statuses.sort((a, b) => {
      const aInfo = parseMigrationFileName(a.file);
      const bInfo = parseMigrationFileName(b.file);
      if (!aInfo || !bInfo) {
        return 0;
      }
      return aInfo.timestamp - bInfo.timestamp;
    });
  }
}
