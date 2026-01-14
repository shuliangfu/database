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
      logger.log("query", "SELECT * FROM users", [], 10);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe("query");
      expect(logs[0].sql).toBe("SELECT * FROM users");
      expect(logs[0].duration).toBe(10);
    });

    it("应该记录执行日志", () => {
      const logger = new QueryLogger();
      logger.log(
        "execute",
        "INSERT INTO users (name) VALUES (?)",
        ["Alice"],
        5,
      );

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe("execute");
      expect(logs[0].sql).toBe("INSERT INTO users (name) VALUES (?)");
      expect(logs[0].params).toEqual(["Alice"]);
      expect(logs[0].duration).toBe(5);
    });

    it("应该记录错误日志", () => {
      const logger = new QueryLogger();
      const error = new Error("Database error");
      logger.log("query", "SELECT * FROM users", [], 10, error);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe(error);
    });

    it("应该在禁用时不记录日志", () => {
      const logger = new QueryLogger({ enabled: false });
      logger.log("query", "SELECT * FROM users", [], 10);

      const logs = logger.getLogs();
      expect(logs.length).toBe(0);
    });

    it("应该在 logLevel 为 error 时只记录错误", () => {
      const logger = new QueryLogger({ logLevel: "error" });
      logger.log("query", "SELECT * FROM users", [], 10);
      logger.log("query", "SELECT * FROM posts", [], 20, new Error("Error"));

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("SELECT * FROM posts");
      expect(logs[0].error).toBeTruthy();
    });

    it("应该在 logLevel 为 slow 时只记录慢查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 100,
      });
      logger.log("query", "SELECT * FROM users", [], 50); // 快查询
      logger.log("query", "SELECT * FROM posts", [], 150); // 慢查询
      logger.log("query", "SELECT * FROM comments", [], 200); // 慢查询

      const logs = logger.getLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].sql).toBe("SELECT * FROM posts");
      expect(logs[1].sql).toBe("SELECT * FROM comments");
    });

    it("应该在 logLevel 为 slow 时记录错误查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 100,
      });
      const error = new Error("Database error");
      logger.log("query", "SELECT * FROM users", [], 50, error); // 快查询但有错误

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe(error);
    });

    it("应该记录时间戳", () => {
      const logger = new QueryLogger();
      const before = new Date();
      logger.log("query", "SELECT * FROM users", [], 10);
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
      logger.log("query", "SELECT * FROM users", [], 10);
      logger.log("execute", "INSERT INTO users", [], 5);

      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();

      expect(logs1.length).toBe(2);
      expect(logs2.length).toBe(2);
      // 应该返回不同的数组实例
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
      logger.log("query", "SELECT * FROM users", [], 10);
      logger.log("execute", "INSERT INTO users", [], 5);

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
      logger.log("query", "SELECT 1", [], 10);
      logger.log("query", "SELECT 2", [], 20);
      logger.log("query", "SELECT 3", [], 30);

      const logs = logger.getLogs();
      expect(logs.length).toBe(3);
    });

    it("应该在 logLevel 为 error 时只记录错误", () => {
      const logger = new QueryLogger({ logLevel: "error" });
      logger.log("query", "SELECT 1", [], 10);
      logger.log("query", "SELECT 2", [], 20, new Error("Error"));
      logger.log("query", "SELECT 3", [], 30);

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("SELECT 2");
    });

    it("应该在 logLevel 为 slow 时只记录慢查询", () => {
      const logger = new QueryLogger({
        logLevel: "slow",
        slowQueryThreshold: 50,
      });
      logger.log("query", "SELECT 1", [], 10); // 快查询
      logger.log("query", "SELECT 2", [], 100); // 慢查询
      logger.log("query", "SELECT 3", [], 20); // 快查询

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].sql).toBe("SELECT 2");
    });
  });
});
