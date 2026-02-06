/**
 * ORM 国际化支持
 *
 * 定义翻译函数类型，供 SQLModel、MongoModel 等使用。
 * 由框架（如 dweb）传入 translate 实现，验证错误等用户-facing 文案将使用此函数翻译。
 *
 * @module
 */

/**
 * 翻译函数类型（用于 i18n，由框架传入）
 *
 * @param key 翻译 key，如 "log.validation.required"
 * @param params 占位符参数，如 { field: "name", min: 1 }
 * @returns 翻译后的字符串，无翻译时返回 undefined
 */
export type ModelTranslateFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string | undefined;
