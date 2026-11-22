/**
 * 安全地把查询结果、缓存值和钩子产物赋到目标对象上，
 * 丢弃 __proto__ / constructor / prototype，避免原型污染。
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

export function assignData<T extends object>(
  target: T,
  ...sources: Array<unknown>
): T {
  for (const source of sources) {
    if (source == null || typeof source !== "object") continue;
    for (const key of Object.keys(source as object)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      (target as Record<string, unknown>)[key] =
        (source as Record<string, unknown>)[key];
    }
  }
  return target;
}

/** 安全读写动态字段，避免把实例断言为 any。 */
export function getRecordValue(target: object, key: string): unknown {
  return (target as Record<string, unknown>)[key];
}

export function setRecordValue(
  target: object,
  key: string,
  value: unknown,
): void {
  if (isForbiddenKey(key)) return;
  (target as Record<string, unknown>)[key] = value;
}

/** 把动态主键值收窄为模型 ID；否则返回 null。 */
export function asModelId(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object" && "toString" in value) {
    const text = String(value);
    if (text && text !== "[object Object]") return text;
  }
  return null;
}
