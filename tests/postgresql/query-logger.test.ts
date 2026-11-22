/**
 * @fileoverview 查询日志记录器测试（用例见 tests/shared/cases/query-logger.ts）
 */

import { postgresFixture } from "../shared/fixture.ts";
import { registerQueryLoggerTests } from "../shared/cases/query-logger.ts";

registerQueryLoggerTests(postgresFixture.kind);
