/**
 * @fileoverview 数据验证测试（用例见 tests/shared/cases/validation.ts）
 */

import { mongoFixture } from "../shared/fixture.ts";
import { registerValidationTests } from "../shared/cases/validation.ts";

registerValidationTests(mongoFixture);
