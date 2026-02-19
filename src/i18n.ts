/**
 * @module @dreamer/database/i18n
 *
 * @fileoverview 数据库包 i18n：使用 $tr + 模块实例，不挂全局；供适配器、模型、初始化等使用。
 *
 * 支持在配置或模型中传入 lang 指定语言；未传时自动检测环境语言（LANGUAGE / LC_ALL / LANG）。
 * 默认语言 en-US。文案来自 src/locales/zh-CN.json、en-US.json。
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import zhCN from "./locales/zh-CN.json" with { type: "json" };
import enUS from "./locales/en-US.json" with { type: "json" };

/** 支持的 locale；英语使用 en-US */
export type Locale = "zh-CN" | "en-US";

/** 默认语言（与框架统一为 en-US） */
export const DEFAULT_LOCALE: Locale = "en-US";

/** 数据库包支持的 locale 列表（仅 zh-CN、en-US） */
const DATABASE_LOCALES: Locale[] = ["zh-CN", "en-US"];

const LOCALE_DATA: Record<string, TranslationData> = {
  "zh-CN": zhCN as TranslationData,
  "en-US": enUS as TranslationData,
};

/** init 时创建的数据库包实例，不挂全局，$tr 专用 */
let databaseI18n: I18n | null = null;

/**
 * 从环境变量检测系统语言（优先级：LANGUAGE > LC_ALL > LANG），
 * 无法检测或不在支持列表时返回 en-US。
 */
export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return DEFAULT_LOCALE;

  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;

  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (DATABASE_LOCALES.includes(normalized)) return normalized;
  }

  const primary = first.substring(0, 2).toLowerCase();
  for (const locale of DATABASE_LOCALES) {
    if (locale.startsWith(primary + "-") || locale === primary) return locale;
  }
  return DEFAULT_LOCALE;
}

/** 内部初始化，导入 i18n 时自动执行，不导出 */
function initDatabaseI18n(): void {
  if (databaseI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...DATABASE_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  databaseI18n = i18n;
}

initDatabaseI18n();

/**
 * 设置数据库包当前语言（适配器在 connect 时调用，后续该上下文中 $tr 可不传 lang 即使用该语言）。
 * @param locale 语言，如 "zh-CN" | "en-US"
 */
export function setDatabaseLocale(locale: Locale): void {
  if (!databaseI18n) initDatabaseI18n();
  if (databaseI18n) databaseI18n.setLocale(locale);
}

/**
 * 框架专用翻译函数：仅用本模块 init 时创建的实例。
 * 未传 lang 时使用当前 locale（可由 setDatabaseLocale 设置）；传 lang 时临时切换后恢复。未 init 时返回 key。
 *
 * @param key 文案 key，如 "init.notConfigured"、"log.validation.required"
 * @param params 占位替换，如 { field: "name" }
 * @param lang 语言，不传则使用当前 locale
 */
export function $tr(
  key: string,
  params?: Record<string, string | number>,
  lang?: Locale,
): string {
  if (!databaseI18n) initDatabaseI18n();
  if (!databaseI18n) return key;
  if (lang !== undefined) {
    const prev = databaseI18n.getLocale();
    databaseI18n.setLocale(lang);
    try {
      return databaseI18n.t(key, params as TranslationParams);
    } finally {
      databaseI18n.setLocale(prev);
    }
  }
  return databaseI18n.t(key, params as TranslationParams);
}
