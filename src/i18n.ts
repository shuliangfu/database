/**
 * @module @dreamer/database/i18n
 *
 * @fileoverview 数据库包 i18n 桥接：使用 @dreamer/i18n 的 $t，供适配器、模型、初始化等使用
 *
 * 支持在配置或模型中传入 lang 指定语言；未传时自动检测环境语言（LANGUAGE / LC_ALL / LANG），与 console 行为一致。
 * 英语使用 en-US。文案来自 src/locales/zh-CN.json、en-US.json。
 */

import {
  $i18n,
  getGlobalI18n,
  getI18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import zhCN from "./locales/zh-CN.json" with { type: "json" };
import enUS from "./locales/en-US.json" with { type: "json" };

/** 支持的 locale，zh-CN 为默认；英语使用 en-US */
export type Locale = "zh-CN" | "en-US";

/** 默认语言（与历史行为一致） */
export const DEFAULT_LOCALE: Locale = "zh-CN";

/** 数据库包支持的 locale 列表（仅 zh-CN、en-US） */
const DATABASE_LOCALES: Locale[] = ["zh-CN", "en-US"];

let databaseTranslationsLoaded = false;

/**
 * 从环境变量检测系统语言（优先级：LANGUAGE > LC_ALL > LANG），
 * 无法检测或不在支持列表时返回 en-US。
 */
export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return "en-US";

  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return "en-US";

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
  return "en-US";
}

/**
 * 确保数据库文案已注入到当前使用的 I18n 实例（懒加载，仅执行一次）
 * 优先注入到全局已安装的实例（如 dweb 的 initDwebI18n），否则注入到 getI18n()。
 */
export function ensureDatabaseI18n(): void {
  if (databaseTranslationsLoaded) return;
  const i18n = getGlobalI18n() ?? getI18n();
  i18n.loadTranslations("zh-CN", zhCN as TranslationData);
  i18n.loadTranslations("en-US", enUS as TranslationData);
  databaseTranslationsLoaded = true;
}

/**
 * 根据 key 取翻译文案（使用全局 $t）
 *
 * - 传了 lang：临时切换为该语言后调用 $t，再恢复原 locale
 * - 未传 lang：先按环境变量检测语言（detectLocale），再与当前 $i18n.getLocale() 取其一，
 *   设为当前 locale 后调用 $t（后续未传 lang 的调用会沿用该 locale）
 *
 * @param key 文案 key，如 "init.notConfigured"、"log.validation.required"
 * @param params 占位替换，如 { field: "name" } -> 替换 {field}（boolean 由 @dreamer/i18n 转为 "true"/"false"）
 * @param lang 语言，不传则自动检测环境语言（LANGUAGE/LC_ALL/LANG），再回退当前 locale 或 zh-CN
 * @returns 翻译后的字符串
 */
export function $t(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  ensureDatabaseI18n();
  const current = $i18n.getLocale();
  const isSupported = (l: string): l is Locale =>
    DATABASE_LOCALES.includes(l as Locale);

  if (lang !== undefined) {
    const prev = current;
    $i18n.setLocale(lang);
    try {
      return $i18n.t(key, params);
    } finally {
      $i18n.setLocale(prev);
    }
  }

  const effective: Locale = isSupported(current) ? current : detectLocale();
  $i18n.setLocale(effective);
  return $i18n.t(key, params);
}
