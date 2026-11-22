/**
 * @fileoverview 查询日志记录器测试（用例见 tests/shared/cases/query-logger.ts）
 */

import { sqliteFixture } from "../shared/fixture.ts";
import { registerQueryLoggerTests } from "../shared/cases/query-logger.ts";

registerQueryLoggerTests(sqliteFixture.kind);
