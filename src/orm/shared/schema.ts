/**
 * Schema 键、虚拟字段缓存与应用。
 */

type VirtualEntry = [string, (instance: any) => any];

const schemaKeysCache = new Map<object, string[]>();
const virtualsCache = new WeakMap<object, VirtualEntry[]>();

/**
 * 获取 Schema 键（带缓存）
 */
export function getSchemaKeys(
  owner: object,
  schema: Record<string, unknown> | undefined | null,
): string[] {
  if (!schema) {
    return [];
  }

  let keys = schemaKeysCache.get(owner);
  if (!keys) {
    keys = Object.keys(schema);
    schemaKeysCache.set(owner, keys);
  }
  return keys;
}

/**
 * 获取虚拟字段定义（带缓存）
 */
export function getVirtuals(
  owner: object,
  virtuals: Record<string, (instance: any) => any> | undefined | null,
): VirtualEntry[] {
  if (!virtuals) {
    return [];
  }

  let cached = virtualsCache.get(owner);
  if (!cached) {
    cached = Object.entries(virtuals) as VirtualEntry[];
    virtualsCache.set(owner, cached);
  }
  return cached;
}

/**
 * 应用虚拟字段到实例
 */
export function applyVirtuals(
  owner: object,
  instance: any,
  virtuals?: Record<string, (instance: any) => any> | undefined | null,
): void {
  const entries = getVirtuals(
    owner,
    virtuals ?? (owner as { virtuals?: Record<string, (instance: any) => any> })
      .virtuals,
  );
  if (entries.length === 0) {
    return;
  }

  for (const [name, getter] of entries) {
    Object.defineProperty(instance, name, {
      get: () => getter(instance),
      enumerable: true,
      configurable: true,
    });
  }
}
