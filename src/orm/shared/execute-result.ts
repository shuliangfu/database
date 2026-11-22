/**
 * 适配器 execute() 返回值的只读视图。
 * 各驱动字段不完全一致，这里用可选字段统一读取，避免 as any。
 */
export interface SqlExecuteResult {
  affectedRows?: number;
  insertId?: number | string | null;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  changes?: number;
  lastInsertRowid?: number | string | null;
}

export function asExecuteResult(value: unknown): SqlExecuteResult {
  if (value && typeof value === "object") {
    return value as SqlExecuteResult;
  }
  return {};
}

export function readAffectedRows(value: unknown): number {
  if (typeof value === "number") return value;
  const result = asExecuteResult(value);
  return result.affectedRows ?? result.rowCount ?? result.changes ?? 0;
}

export function readInsertId(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const id = rec.insertId ?? rec.lastInsertRowid ?? rec.insertedId;
  return id === undefined ? null : id;
}

export function readResultRows(value: unknown): Record<string, unknown>[] {
  const rows = asExecuteResult(value).rows;
  return Array.isArray(rows) ? rows : [];
}

export function readNumericField(value: unknown, ...keys: string[]): number {
  if (!value || typeof value !== "object") return 0;
  const rec = value as Record<string, unknown>;
  for (const key of keys) {
    const n = rec[key];
    if (typeof n === "number") return n;
  }
  return 0;
}

export function readInsertedIds(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>).insertedIds;
}

export function readInsertedIdAt(map: unknown, index: number): unknown {
  if (map == null) return undefined;
  if (Array.isArray(map)) return map[index];
  if (typeof map === "object") {
    return (map as Record<string, unknown>)[String(index)];
  }
  return undefined;
}
