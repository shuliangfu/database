/**
 * @fileoverview 查询日志记录器测试
 */

import { describe, expect, it } from "@dreamer/test";
import { QueryLogger } from "../../src/logger/query-logger.ts";

describe("QueryLogger", () => {
  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      const logger = new QueryLogger();

      expect(logger).toBeTruthy();
      const logs = logger.getLogs();
      expect(logs).toEqual([]);
    });

    it("应该使用自定义配置创建实例", () => {
      const logger = new QueryLogger({
        enabled: false,
        logLevel: "error",
        slowQueryThreshold: 2000,
      });

      expect(logger).toBeTruthy();
    });
  });

  describe("log", () => {
    it("应该记录查询日志", () => {
      const logger = new QueryLogger();
      logger.log("query", "users", [{ name: "Alice" }], 10);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe("query");
      expect(logs[0].sql).toBe("users");
      expect(logs[0].duration).toBe(10);
    });

    it("应该记录执行日志", () => {
      const logger = new QueryLogger();
      logger.log("execute", "users", [{ name: "Alice" }], 5);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe("execute");
      expect(logs[0].sql).toBe("users");
      expect(logs[0].params).toEqual([{ name: "Alice" }]);
      expect(logs[0].duration).toBe(5);
    });

    it("应该记录错误日志", () => {
      const logger = new QueryLogger();
      const error = new Error("Database error");
      logger.log("query", "users", [], 10, error);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe(error);
    });

    it("应该在禁用时不记录日志", () => {
      const logger = new QueryLogger({ enabled: false });
      logger.log("query", "users", [], 10);

      const logs = logger.getLogs();
      expect(logs.length).toBe(0);
    });

    it("应该在 logLevel 为 error 时只记录错误", () => {
      const logger = new QueryLogger({ logLevel: "error" });
      logger.log("query", "users", [], 10);
      logger.log("query", "posts", [], 20, new Error("Error"));

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("posts");
      expect(logs[0].error).toBeTruthy();
    });

    it("应该在 logLevel 为 slow 时只记录慢查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 100,
      });
      logger.log("query", "users", [], 50);
      logger.log("query", "posts", [], 150);
      logger.log("query", "comments", [], 200);

      const logs = logger.getLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].sql).toBe("posts");
      expect(logs[1].sql).toBe("comments");
    });

    it("应该在 logLevel 为 slow 时记录错误查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 100,
      });
      const error = new Error("Database error");
      logger.log("query", "users", [], 50, error);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe(error);
    });

    it("应该记录时间戳", () => {
      const logger = new QueryLogger();
      const before = new Date();
      logger.log("query", "users", [], 10);
      const after = new Date();

      const logs = logger.getLogs();
      expect(logs[0].timestamp).toBeInstanceOf(Date);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("getLogs", () => {
    it("应该返回所有日志的副本", () => {
      const logger = new QueryLogger();
      logger.log("query", "users", [], 10);
      logger.log("execute", "users", [], 5);

      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();

      expect(logs1.length).toBe(2);
      expect(logs2.length).toBe(2);
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });

    it("应该在无日志时返回空数组", () => {
      const logger = new QueryLogger();
      const logs = logger.getLogs();

      expect(logs).toEqual([]);
    });
  });

  describe("clear", () => {
    it("应该清空所有日志", () => {
      const logger = new QueryLogger();
      logger.log("query", "users", [], 10);
      logger.log("execute", "users", [], 5);

      expect(logger.getLogs().length).toBe(2);

      logger.clear();

      expect(logger.getLogs().length).toBe(0);
    });

    it("应该在无日志时安全调用", () => {
      const logger = new QueryLogger();
      logger.clear();

      expect(logger.getLogs().length).toBe(0);
    });
  });

  describe("getLogger", () => {
    it("应该返回 logger 实例", () => {
      const logger = new QueryLogger();
      const loggerInstance = logger.getLogger();

      expect(loggerInstance).toBeTruthy();
      expect(typeof loggerInstance.debug).toBe("function");
      expect(typeof loggerInstance.info).toBe("function");
      expect(typeof loggerInstance.warn).toBe("function");
      expect(typeof loggerInstance.error).toBe("function");
    });

    it("应该返回自定义 logger 实例", () => {
      const customLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      const queryLogger = new QueryLogger({ logger: customLogger as any });
      const loggerInstance = queryLogger.getLogger();

      expect(loggerInstance).toBe(customLogger);
    });
  });

  describe("日志级别过滤", () => {
    it("应该在 logLevel 为 all 时记录所有日志", () => {
      const logger = new QueryLogger({ logLevel: "all" });
      logger.log("query", "collection1", [], 10);
      logger.log("query", "collection2", [], 20);
      logger.log("query", "collection3", [], 30);

      const logs = logger.getLogs();
      expect(logs.length).toBe(3);
    });

    it("应该在 logLevel 为 error 时只记录错误", () => {
      const logger = new QueryLogger({ logLevel: "error" });
      logger.log("query", "collection1", [], 10);
      logger.log("query", "collection2", [], 20, new Error("Error"));
      logger.log("query", "collection3", [], 30);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("collection2");
    });

    it("应该在 logLevel 为 slow 时只记录慢查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 50,
      });
      logger.log("query", "collection1", [], 10);
      logger.log("query", "collection2", [], 100);
      logger.log("query", "collection3", [], 20);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("collection2");
    });
  });

  describe("翻译函数 (t)", () => {
    it("未传入 t 时使用默认 fallback", () => {
      const calls: { method: string; msg: string }[] = [];
      const mockLogger = {
        debug: (msg: string) => calls.push({ method: "debug", msg }),
        info: (msg: string) => calls.push({ method: "info", msg }),
        warn: (msg: string) => calls.push({ method: "warn", msg }),
        error: (msg: string) => calls.push({ method: "error", msg }),
      };
      const logger = new QueryLogger({
        logger: mockLogger as any,
        logLevel: "all",
      });
      logger.log("query", "SELECT 1", [], 10);

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("debug");
      expect(calls[0].msg).toContain("数据库");
      expect(calls[0].msg).toContain("查询");
      expect(calls[0].msg).toContain("SELECT 1");
    });

    it("传入 t 且返回翻译时使用翻译文本", () => {
      const calls: { method: string; msg: string }[] = [];
      const mockLogger = {
        debug: (msg: string) => calls.push({ method: "debug", msg }),
        info: (msg: string) => calls.push({ method: "info", msg }),
        warn: (msg: string) => calls.push({ method: "warn", msg }),
        error: (msg: string) => calls.push({ method: "error", msg }),
      };
      const t = (key: string) =>
        key === "log.database.queryInfo" ? "Query: {sql}" : undefined;
      const logger = new QueryLogger({
        logger: mockLogger as any,
        t,
        logLevel: "all",
      });
      logger.log("query", "SELECT 1", [], 10);

      expect(calls[0].msg).toBe("Query: {sql}");
    });

    it("传入 t 但返回 undefined 时使用 fallback", () => {
      const calls: { method: string; msg: string }[] = [];
      const mockLogger = {
        debug: (msg: string) => calls.push({ method: "debug", msg }),
        info: (msg: string) => calls.push({ method: "info", msg }),
        warn: (msg: string) => calls.push({ method: "warn", msg }),
        error: (msg: string) => calls.push({ method: "error", msg }),
      };
      const t = () => undefined;
      const logger = new QueryLogger({
        logger: mockLogger as any,
        t,
        logLevel: "all",
      });
      logger.log("query", "SELECT 1", [], 10);

      expect(calls[0].msg).toContain("数据库查询");
      expect(calls[0].msg).toContain("SELECT 1");
    });

    it("传入 t 且带 params 时正确传递参数", () => {
      const calls: { method: string; msg: string }[] = [];
      const mockLogger = {
        debug: (msg: string) => calls.push({ method: "debug", msg }),
        info: (msg: string) => calls.push({ method: "info", msg }),
        warn: (msg: string) => calls.push({ method: "warn", msg }),
        error: (msg: string) => calls.push({ method: "error", msg }),
      };
      const t = (
        key: string,
        params?: Record<string, string | number | boolean>,
      ) =>
        key === "log.database.slowQuery"
          ? `Slow: ${params?.sql} ${params?.duration}ms`
          : undefined;
      const logger = new QueryLogger({
        logger: mockLogger as any,
        t,
        logLevel: "all",
        slowQueryThreshold: 5,
      });
      logger.log("query", "SELECT * FROM big_table", [], 100);

      expect(calls[0].method).toBe("warn");
      expect(calls[0].msg).toBe("Slow: SELECT * FROM big_table 100ms");
    });
  });

  describe("debug 参数", () => {
    it("debug 为 false 时正常查询调用 logger.debug", () => {
      const calls: { method: string }[] = [];
      const mockLogger = {
        debug: () => calls.push({ method: "debug" }),
        info: () => calls.push({ method: "info" }),
        warn: () => calls.push({ method: "warn" }),
        error: () => calls.push({ method: "error" }),
      };
      const logger = new QueryLogger({
        logger: mockLogger as any,
        debug: false,
        logLevel: "all",
      });
      logger.log("query", "SELECT 1", [], 10);

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("debug");
    });

    it("debug 为 true 时正常查询调用 logger.info", () => {
      const calls: { method: string }[] = [];
      const mockLogger = {
        debug: () => calls.push({ method: "debug" }),
        info: () => calls.push({ method: "info" }),
        warn: () => calls.push({ method: "warn" }),
        error: () => calls.push({ method: "error" }),
      };
      const logger = new QueryLogger({
        logger: mockLogger as any,
        debug: true,
        logLevel: "all",
      });
      logger.log("query", "SELECT 1", [], 10);

      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe("info");
    });

    it("错误和慢查询不受 debug 影响，仍使用 error/warn", () => {
      const calls: { method: string }[] = [];
      const mockLogger = {
        debug: () => calls.push({ method: "debug" }),
        info: () => calls.push({ method: "info" }),
        warn: () => calls.push({ method: "warn" }),
        error: () => calls.push({ method: "error" }),
      };
      const logger = new QueryLogger({
        logger: mockLogger as any,
        debug: true,
        logLevel: "all",
        slowQueryThreshold: 5,
      });
      logger.log("query", "SELECT 1", [], 10, new Error("err"));
      logger.log("query", "SELECT 2", [], 100);

      expect(calls[0].method).toBe("error");
      expect(calls[1].method).toBe("warn");
    });
  });
});
