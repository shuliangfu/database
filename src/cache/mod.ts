/**
 * 缓存适配器模块导出
 * 使用 @dreamer/cache 库
 */

export type { CacheAdapter } from "./cache-adapter.ts";
export { MemoryCacheAdapter } from "./memory-cache.ts";

// 同时导出 @dreamer/cache 的其他适配器和工具
export {
  CacheManager,
  MemoryAdapter,
  MultiLevelCache,
} from "jsr:@dreamer/cache@^1.0.0-beta.2";
export type { CacheStrategy } from "jsr:@dreamer/cache@^1.0.0-beta.2";
