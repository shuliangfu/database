/**
 * 查询日志与错误消息中的凭据脱敏。
 */

const SENSITIVE_KEY =
  /^(password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|auth|credential|credentials|connectionstring|private[_-]?key)$/i;

/** mongodb://user:pass@host 以及 postgres/mysql 风格的 user:pass@ */
const URI_CREDENTIAL = /(:\/\/[^:/?#]+:)([^@/?#]+)(@)/gi;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function redactSensitiveText(text: string): string {
  return text.replace(URI_CREDENTIAL, "$1[Redacted]$3");
}

export function redactValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveKey(key)) {
    return "[Redacted]";
  }
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }
  return value;
}

export function redactParams(params: unknown): unknown {
  return redactValue(params);
}
