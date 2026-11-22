/**
 * @fileoverview 共享测试辅助：模型绑定与条件 it()
 */

import { it } from "@dreamer/test";
import type { AnyModelClass, EngineFixture, EngineKind } from "./fixture.ts";

/** 为测试模型设置表名/集合名与主键 */
export function bindStore(
  cls: AnyModelClass,
  fx: EngineFixture,
  store: string,
): void {
  (cls as any)[fx.storeProp] = store;
  cls.primaryKey = fx.primaryKey;
}

/** Mongo 集成测试需要关闭 Deno 资源消毒器；SQL 保持原行为 */
export function itFor(
  fx: EngineFixture,
  name: string,
  fn: () => void | Promise<void>,
  options?: { sanitizeOps: false; sanitizeResources: false },
): void {
  const mongoOpts = fx.itOptions();
  const opts = options ?? mongoOpts;
  if (opts) {
    it(name, fn, opts);
  } else {
    it(name, fn);
  }
}

/** SQL 占位符：PostgreSQL 为 $n，其余为 ? */
export function sqlPlaceholder(kind: EngineKind, index: number): string {
  return kind === "postgresql" ? `$${index}` : "?";
}

/** 生成 VALUES ($1, $2, ...) 或 (?, ?, ...) */
export function sqlPlaceholders(kind: EngineKind, count: number): string {
  return Array.from({ length: count }, (_, i) => sqlPlaceholder(kind, i + 1))
    .join(", ");
}
