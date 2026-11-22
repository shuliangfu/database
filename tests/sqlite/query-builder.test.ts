/**
 * @fileoverview SQLStatementBuilder 测试（用例见 tests/shared/cases/query-builder.ts）
 */

import { sqliteFixture } from "../shared/fixture.ts";
import { registerSqlQueryBuilderTests } from "../shared/cases/query-builder.ts";

registerSqlQueryBuilderTests(sqliteFixture);
