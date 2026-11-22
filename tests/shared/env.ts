/**
 * @fileoverview 测试用环境变量读取
 */

import { getEnv } from "@dreamer/runtime-adapter";

/** 读取环境变量，缺失时返回默认值 */
export function getEnvWithDefault(key: string, defaultValue = ""): string {
  return getEnv(key) || defaultValue;
}
