/**
 * @fileoverview 数据库初始化工具测试（用例见 tests/shared/cases/init-database.ts）
 */

import { sqliteFixture } from "../shared/fixture.ts";
import { registerInitDatabaseTests } from "../shared/cases/init-database.ts";

registerInitDatabaseTests(sqliteFixture);
