/**
 * @fileoverview Model 测试（共用用例见 tests/shared/cases/model.ts）
 */

import { mysqlFixture } from "../shared/fixture.ts";
import { registerModelTests } from "../shared/cases/model.ts";

registerModelTests(mysqlFixture);
