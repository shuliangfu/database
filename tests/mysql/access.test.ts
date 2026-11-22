/**
 * @fileoverview 数据库访问辅助函数测试（用例见 tests/shared/cases/access.ts）
 */

import { mysqlFixture } from "../shared/fixture.ts";
import { registerAccessTests } from "../shared/cases/access.ts";

registerAccessTests(mysqlFixture);
