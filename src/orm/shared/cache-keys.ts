/**
 * 模型查询缓存键的生成与清理。
 */

import type { CacheAdapter } from "../../cache/mod.ts";
import type { CacheQueryOptions } from "./types.ts";

const cacheKeyCache = new WeakMap<object, Map<string, string>>();

/**
 * 序列化缓存键参数（用于缓存键缓存）
 */
export function serializeCacheKeyParams(
  condition: unknown,
  fields?: string[],
  options?: CacheQueryOptions,
  includeTrashed?: boolean,
  onlyTrashed?: boolean,
): string {
  const parts: string[] = [];

  if (typeof condition === "number" || typeof condition === "string") {
    parts.push(`c:${condition}`);
  } else if (typeof condition === "object" && condition !== null) {
    const keys = Object.keys(condition).sort();
    const rec = condition as Record<string, unknown>;
    parts.push(
      `c:${keys.map((k) => `${k}:${rec[k]}`).join(",")}`,
    );
  } else {
    parts.push(`c:${String(condition)}`);
  }

  parts.push(`f:${fields ? fields.sort().join(",") : "*"}`);

  if (options) {
    if (options.sort) {
      const sortStr = typeof options.sort === "string"
        ? options.sort
        : Object.keys(options.sort).sort().map((k) =>
          `${k}:${(options.sort as Record<string, 1 | -1 | "asc" | "desc">)[k]}`
        ).join(",");
      parts.push(`s:${sortStr}`);
    }
    if (options.skip !== undefined) {
      parts.push(`sk:${options.skip}`);
    }
    if (options.limit !== undefined) {
      parts.push(`l:${options.limit}`);
    }
    if (options.with) {
      parts.push(`w:${options.with}`);
    }
  }

  if (includeTrashed) {
    parts.push("it:1");
  }
  if (onlyTrashed) {
    parts.push("ot:1");
  }

  return parts.join("|");
}

/**
 * 生成缓存键（带缓存优化）。无缓存适配器时返回空字符串。
 */
export function generateModelCacheKey(
  owner: object,
  storeName: string,
  hasCacheAdapter: boolean,
  condition: unknown,
  fields?: string[],
  options?: CacheQueryOptions,
  includeTrashed?: boolean,
  onlyTrashed?: boolean,
): string {
  if (!hasCacheAdapter) {
    return "";
  }

  const paramKey = serializeCacheKeyParams(
    condition,
    fields,
    options,
    includeTrashed,
    onlyTrashed,
  );

  let cacheMap = cacheKeyCache.get(owner);
  if (!cacheMap) {
    cacheMap = new Map();
    cacheKeyCache.set(owner, cacheMap);
  }

  const cached = cacheMap.get(paramKey);
  if (cached !== undefined) {
    return cached;
  }

  let conditionStr: string;
  if (typeof condition === "number" || typeof condition === "string") {
    conditionStr = String(condition);
  } else if (typeof condition === "object" && condition !== null) {
    const rec = condition as Record<string, unknown>;
    const keys = Object.keys(rec).sort();
    conditionStr = keys.map((k) => {
      const v = rec[k];
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const obj = v as Record<string, unknown>;
        return `${k}:${
          Object.keys(obj).sort().map((op) => `${op}:${obj[op]}`).join(",")
        }`;
      }
      return `${k}:${v}`;
    }).join("|");
  } else {
    conditionStr = String(condition);
  }

  const parts = [
    storeName,
    conditionStr,
    fields ? fields.sort().join(",") : "*",
    options?.sort
      ? (typeof options.sort === "string"
        ? options.sort
        : Object.keys(options.sort as Record<string, 1 | -1 | "asc" | "desc">)
          .sort().map((k) =>
            `${k}:${
              (options.sort as Record<string, 1 | -1 | "asc" | "desc">)[k]
            }`
          ).join(","))
      : "",
    options?.skip !== undefined ? `skip:${options.skip}` : "",
    options?.limit !== undefined ? `limit:${options.limit}` : "",
    includeTrashed ? "includeTrashed" : "",
    onlyTrashed ? "onlyTrashed" : "",
    options?.with ? `with:${options.with}` : "",
  ];
  const cacheKey = `model:${storeName}:query:${parts.join(":")}`;

  if (cacheMap.size < 1000) {
    cacheMap.set(paramKey, cacheKey);
  }

  return cacheKey;
}

/**
 * 按模型存储名清除相关缓存。
 */
export async function clearModelCache(
  cacheAdapter: CacheAdapter | undefined | null,
  storeName: string,
): Promise<void> {
  if (!cacheAdapter) {
    return;
  }
  const result = cacheAdapter.deleteByTags([`model:${storeName}`]);
  await result;
}
