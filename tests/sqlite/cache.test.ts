/**
 * @fileoverview 缓存机制测试（用例见 tests/shared/cases/cache.ts）
 */

import { sqliteFixture } from "../shared/fixture.ts";
import { registerCacheTests } from "../shared/cases/cache.ts";

registerCacheTests(sqliteFixture);
