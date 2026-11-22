/**
 * @fileoverview 缓存机制测试（用例见 tests/shared/cases/cache.ts）
 */

import { mysqlFixture } from "../shared/fixture.ts";
import { registerCacheTests } from "../shared/cases/cache.ts";

registerCacheTests(mysqlFixture);
