/**
 * 缓存适配器模块导出
 * 使用 @dreamer/cache 库
 */

export type { CacheAdapter, CacheStrategy } from "@dreamer/cache";
export {
  CacheManager,
  MemoryAdapter,
  MemoryAdapter as MemoryCacheAdapter,
  MultiLevelCache,
} from "@dreamer/cache";
