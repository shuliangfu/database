/**
 * MySQL / PostgreSQL 连接池上的共用辅助：健康检查、带超时的关闭、连接重试等待。
 * 两个适配器的池 API 不同，因此不做成强制继承的基类。
 */

import type { HealthCheckResult } from "./base.ts";

export async function waitForRetry(
  retryCount: number,
  retryDelay: number,
): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, retryDelay * (retryCount + 1))
  );
}

export async function healthCheckWithPing(
  ping: () => Promise<unknown>,
  connected: boolean,
  notConnectedMessage: string,
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    if (!connected) {
      return {
        healthy: false,
        error: notConnectedMessage,
        timestamp: new Date(),
      };
    }
    await ping();
    return {
      healthy: true,
      latency: Date.now() - startTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: message,
      timestamp: new Date(),
    };
  }
}

/**
 * 先清理调用方状态，再带超时关闭底层池。超时或失败由调用方记录日志。
 */
export async function closePoolWithTimeout(
  end: () => Promise<unknown>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<void> {
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs);
  });
  await Promise.race([end(), timeoutPromise]);
}
