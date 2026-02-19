/**
 * ORM 国际化支持
 *
 * 导出 Locale 类型；ModelTranslateFn 已废弃，请使用 lang + $tr。
 *
 * @module
 */

export type { Locale } from "../i18n.ts";

/**
 * 翻译函数类型（已废弃，请使用 lang + $t）
 *
 * @deprecated 使用 Model.lang + $tr(key, params, Model.lang) 替代
 */
export type ModelTranslateFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string | undefined;
