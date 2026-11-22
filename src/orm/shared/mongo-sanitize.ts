/**
 * 收紧公开 API 里用户条件对象可使用的 Mongo 操作符。
 * 内部构建器生成的 $gt / $in / $or 等仍合法；拒绝 $where / $function 等可执行操作符，
 * 以及 __proto__ 等原型污染键。
 */

import { isForbiddenKey } from "./safe-assign.ts";

/** 会在服务端执行代码或过于危险的操作符 */
export const DANGEROUS_MONGO_OPERATORS = new Set([
  "$where",
  "$function",
  "$accumulator",
  "$js",
]);

export class UnsafeMongoOperatorError extends Error {
  constructor(operator: string) {
    super(`Unsafe MongoDB operator: ${operator}`);
    this.name = "UnsafeMongoOperatorError";
  }
}

export class UnsafeMongoFieldError extends Error {
  constructor(field: string) {
    super(`Unsafe MongoDB field name: ${field}`);
    this.name = "UnsafeMongoFieldError";
  }
}

/**
 * 递归检查用户条件 / 更新文档 / 聚合管道，发现危险操作符或污染键时抛错。
 * 允许其余 `$` 操作符（$gt、$in、$or、$set 等），以免误伤内部构建器。
 */
export function assertSafeMongoValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeMongoValue(item);
    }
    return;
  }
  if (value == null || typeof value !== "object") {
    return;
  }
  for (const key of Object.keys(value as object)) {
    if (isForbiddenKey(key)) {
      throw new UnsafeMongoFieldError(key);
    }
    if (DANGEROUS_MONGO_OPERATORS.has(key)) {
      throw new UnsafeMongoOperatorError(key);
    }
    assertSafeMongoValue((value as Record<string, unknown>)[key]);
  }
}
