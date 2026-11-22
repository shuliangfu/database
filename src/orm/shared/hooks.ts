/**
 * 钩子合并与时间戳工具（行为与原先模型内实现一致）。
 */

import { assignData } from "./safe-assign.ts";
import type { LifecycleHook, TimestampsConfig } from "./types.ts";

/**
 * 检测对象是否有变化（浅比较，用于优化钩子合并）
 * 性能优化：只在钩子实际修改数据时才合并，避免不必要的对象复制
 */
export function hasObjectChanged(
  before: Record<string, any>,
  after: Record<string, any>,
): boolean {
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  if (beforeKeys.length !== afterKeys.length) {
    return true;
  }

  for (const key of beforeKeys) {
    if (before[key] !== after[key]) {
      return true;
    }
  }

  for (const key of afterKeys) {
    if (!(key in before)) {
      return true;
    }
  }

  return false;
}

/**
 * createMany 风格：只合并钩子修改的、且在原始数据中存在的字段。
 * 有 schema 时再限制为 schema 字段，避免钩子添加非数据库字段。
 */
export function mergeCreateManyHookFields(
  processedData: Record<string, any>,
  tempInstance: Record<string, any>,
  originalKeys: Set<string>,
  schemaKeys?: string[] | null,
): void {
  if (schemaKeys) {
    for (const key of schemaKeys) {
      if (key in tempInstance && originalKeys.has(key)) {
        processedData[key] = tempInstance[key];
      }
    }
    return;
  }
  for (const key of originalKeys) {
    if (key in tempInstance) {
      processedData[key] = tempInstance[key];
    }
  }
}

/**
 * update 风格：合并钩子修改的字段，排除非数据库字段（如 hookData）和主键。
 */
export function mergeUpdateHookFields(
  processedData: Record<string, any>,
  tempInstance: Record<string, any>,
  beforeSnapshot: Record<string, any>,
  existingInstance: Record<string, any> | null | undefined,
  primaryKey: string,
): void {
  for (const key in processedData) {
    if (key in tempInstance && key !== "hookData" && key !== primaryKey) {
      processedData[key] = tempInstance[key];
    }
  }
  if (existingInstance) {
    for (const key in existingInstance) {
      if (
        key !== "hookData" &&
        key !== primaryKey &&
        !(key in processedData) &&
        key in tempInstance &&
        tempInstance[key] !== beforeSnapshot[key]
      ) {
        processedData[key] = tempInstance[key];
      }
    }
  }
}

/**
 * 执行钩子；仅当实例被修改时调用 onChanged。
 * @returns 是否发生了变化
 */
export async function runHookAndMergeIfChanged(
  hook: LifecycleHook | undefined,
  tempInstance: Record<string, any>,
  onChanged: (beforeSnapshot: Record<string, any>) => void,
): Promise<boolean> {
  if (!hook) {
    return false;
  }
  const beforeSnapshot = { ...tempInstance };
  await hook(tempInstance);
  if (hasObjectChanged(beforeSnapshot, tempInstance)) {
    onChanged(beforeSnapshot);
    return true;
  }
  return false;
}

/**
 * Mongo createMany 风格：钩子若修改了临时实例，则整体赋回 item。
 */
export async function assignHookChangesIfChanged(
  hook: LifecycleHook | undefined,
  tempInstance: Record<string, any>,
  item: Record<string, any>,
): Promise<void> {
  await runHookAndMergeIfChanged(hook, tempInstance, () => {
    assignData(item, tempInstance);
  });
}

function timestampFieldNames(
  timestamps: TimestampsConfig,
): { createdAtField: string; updatedAtField: string } | null {
  if (!timestamps) {
    return null;
  }
  if (typeof timestamps === "object") {
    return {
      createdAtField: timestamps.createdAt || "createdAt",
      updatedAtField: timestamps.updatedAt || "updatedAt",
    };
  }
  return { createdAtField: "createdAt", updatedAtField: "updatedAt" };
}

/** 为创建路径填充 createdAt / updatedAt（仅当字段尚未存在）。 */
export function applyCreateTimestamps(
  data: Record<string, any>,
  timestamps: TimestampsConfig,
): void {
  const fields = timestampFieldNames(timestamps);
  if (!fields) {
    return;
  }
  if (!data[fields.createdAtField]) {
    data[fields.createdAtField] = new Date();
  }
  if (!data[fields.updatedAtField]) {
    data[fields.updatedAtField] = new Date();
  }
}

/** 为更新路径写入 updatedAt。 */
export function applyUpdateTimestamp(
  data: Record<string, any>,
  timestamps: TimestampsConfig,
  now: Date = new Date(),
): void {
  const fields = timestampFieldNames(timestamps);
  if (!fields) {
    return;
  }
  data[fields.updatedAtField] = now;
}
