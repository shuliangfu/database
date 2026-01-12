/**
 * Mock SQLite 适配器用于测试
 * 由于 better-sqlite3 在 Deno 中需要原生绑定，我们使用 Mock 适配器来测试
 */

import type { HealthCheckResult, PoolStatus } from "../src/adapters/base.ts";
import { BaseAdapter } from "../src/adapters/base.ts";
import type { DatabaseAdapter, DatabaseConfig } from "../src/types.ts";

/**
 * Mock SQLite 适配器
 * 模拟 SQLite 数据库的行为，用于测试
 */
export class MockSQLiteAdapter extends BaseAdapter {
  private data: Map<string, any[]> = new Map();
  private tables: Set<string> = new Set();

  override async connect(config: DatabaseConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
    this.connected = true;
  }

  override async query(sql: string, params: any[] = []): Promise<any[]> {
    this.ensureConnection();

    // 解析 SQL 语句（简化版，仅用于测试）
    const sqlLower = sql.toLowerCase().trim();

    if (sqlLower.startsWith("select")) {
      return this.handleSelect(sql, params);
    }

    return [];
  }

  override async execute(sql: string, params: any[] = []): Promise<any> {
    this.ensureConnection();

    const sqlLower = sql.toLowerCase().trim();

    if (sqlLower.startsWith("insert")) {
      return this.handleInsert(sql, params);
    } else if (sqlLower.startsWith("update")) {
      return this.handleUpdate(sql, params);
    } else if (sqlLower.startsWith("delete")) {
      return this.handleDelete(sql, params);
    } else if (sqlLower.startsWith("create table")) {
      return this.handleCreateTable(sql);
    }

    return { changes: 0, lastInsertRowid: null };
  }

  override async transaction<T>(
    callback: (db: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    this.ensureConnection();
    // 简化的事务处理：直接执行回调
    return await callback(this);
  }

  override async close(): Promise<void> {
    this.connected = false;
    this.data.clear();
    this.tables.clear();
  }

  override async getPoolStatus(): Promise<PoolStatus> {
    return {
      total: 0,
      idle: 0,
      active: 0,
      waiting: 0,
    };
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.connected,
      latency: 0,
      timestamp: new Date(),
      error: this.connected ? undefined : "Not connected",
    };
  }

  /**
   * 检查连接
   */
  private ensureConnection(): void {
    if (!this.connected) {
      throw new Error("Database not connected");
    }
  }

  /**
   * 处理 SELECT 查询
   */
  private handleSelect(sql: string, params: any[]): any[] {
    // 简化处理：从表名中提取表名
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) {
      return [];
    }

    const tableName = tableMatch[1];
    let rows = this.data.get(tableName) || [];

    // 简单的 WHERE 条件处理
    if (sql.includes("where")) {
      // 处理多个 WHERE 条件
      const wherePatterns = [
        /where\s+(\w+)\s*([><=!]+)\s*\?/i,
        /and\s+(\w+)\s*([><=!]+)\s*\?/i,
        /or\s+(\w+)\s*([><=!]+)\s*\?/i,
      ];

      let paramIndex = 0;
      for (const pattern of wherePatterns) {
        const match = sql.match(pattern);
        if (match) {
          const [, column, operator] = match;
          const value = params[paramIndex++];

          rows = rows.filter((row) => {
            const rowValue = row[column];
            switch (operator.trim()) {
              case ">":
                return rowValue > value;
              case "<":
                return rowValue < value;
              case "=":
              case "==":
                return rowValue === value;
              case "!=":
              case "<>":
                return rowValue !== value;
              default:
                return true;
            }
          });
        }
      }

      // 处理 LIKE 条件
      const likeMatch = sql.match(/(?:where|and|or)\s+(\w+)\s+like\s+\?/i);
      if (likeMatch) {
        const column = likeMatch[1];
        const pattern = params[paramIndex++];
        const regex = new RegExp(
          pattern.replace(/%/g, ".*").replace(/_/g, "."),
          "i",
        );
        rows = rows.filter((row) => regex.test(String(row[column])));
      }
    }

    return rows;
  }

  /**
   * 处理 INSERT 语句
   */
  private handleInsert(sql: string, params: any[]): any {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) {
      return { changes: 0, lastInsertRowid: null };
    }

    const tableName = tableMatch[1];
    const columnsMatch = sql.match(/\(([^)]+)\)/);
    if (!columnsMatch) {
      return { changes: 0, lastInsertRowid: null };
    }

    const columns = columnsMatch[1].split(",").map((c) => c.trim());
    const row: any = { id: Date.now() };

    columns.forEach((col, index) => {
      if (params[index] !== undefined) {
        row[col] = params[index];
      }
    });

    const rows = this.data.get(tableName) || [];
    rows.push(row);
    this.data.set(tableName, rows);

    return {
      changes: 1,
      lastInsertRowid: row.id,
    };
  }

  /**
   * 处理 UPDATE 语句
   */
  private handleUpdate(sql: string, params: any[]): any {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) {
      return { changes: 0 };
    }

    const tableName = tableMatch[1];
    let rows = this.data.get(tableName) || [];

    // 解析 SET 子句
    const setMatches = sql.matchAll(/set\s+(\w+)\s*=\s*\?/gi);
    const updates: Array<{ column: string; value: any }> = [];
    let paramIndex = 0;

    for (const match of setMatches) {
      updates.push({
        column: match[1],
        value: params[paramIndex++],
      });
    }

    // 处理 WHERE 条件
    let filteredRows = rows;
    if (sql.includes("where")) {
      const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const column = whereMatch[1];
        const value = params[paramIndex];
        filteredRows = rows.filter((row) => row[column] === value);
      }
    }

    // 更新匹配的行
    let changes = 0;
    rows = rows.map((row) => {
      const shouldUpdate = filteredRows.includes(row);
      if (shouldUpdate) {
        changes++;
        const updated = { ...row };
        updates.forEach(({ column, value }) => {
          updated[column] = value;
        });
        return updated;
      }
      return row;
    });

    this.data.set(tableName, rows);

    return { changes };
  }

  /**
   * 处理 DELETE 语句
   */
  private handleDelete(sql: string, params: any[]): any {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) {
      return { changes: 0 };
    }

    const tableName = tableMatch[1];
    let rows = this.data.get(tableName) || [];

    // 处理 WHERE 条件
    if (sql.includes("where")) {
      const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const column = whereMatch[1];
        const value = params[0];
        const beforeLength = rows.length;
        rows = rows.filter((row) => row[column] !== value);
        this.data.set(tableName, rows);
        return { changes: beforeLength - rows.length };
      }
    }

    // 没有 WHERE 条件：删除所有行
    const beforeLength = rows.length;
    this.data.set(tableName, []);

    return { changes: beforeLength };
  }

  /**
   * 处理 CREATE TABLE 语句
   */
  private handleCreateTable(sql: string): any {
    const tableMatch = sql.match(/create\s+table\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      this.tables.add(tableName);
      this.data.set(tableName, []);
    }

    return { changes: 0 };
  }

  /**
   * 测试辅助方法：清空表数据
   */
  clearTable(tableName: string): void {
    this.data.set(tableName, []);
  }

  /**
   * 测试辅助方法：获取表数据
   */
  getTableData(tableName: string): any[] {
    return this.data.get(tableName) || [];
  }

  /**
   * 测试辅助方法：设置表数据
   */
  setTableData(tableName: string, data: any[]): void {
    this.data.set(tableName, data);
  }
}
