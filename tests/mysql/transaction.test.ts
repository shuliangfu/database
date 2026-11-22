/**
 * @fileoverview 事务和嵌套事务测试（用例见 tests/shared/cases/transaction.ts）
 */

import { mysqlFixture } from "../shared/fixture.ts";
import { registerSqlTransactionTests } from "../shared/cases/transaction.ts";

registerSqlTransactionTests(mysqlFixture);
