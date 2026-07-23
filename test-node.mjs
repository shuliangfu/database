#!/usr/bin/env node
/**
 * Node.js test runner — runs SQLite unit tests in the MAIN process (no --test flag).
 *
 * 【Why 根源】同 foundry：Node 22 的 `node --test` 单文件仍 fork 子进程，子进程 stdout 作
 * TAP/IPC 通道被非 TAP 输出污染致 `structuredClone` 反序列化失败。改 `node --import tsx
 * --test-force-exit <file>` 不带 `--test` 标志，node:test 主进程内自动执行注册用例。
 *
 * 【--experimental-sqlite】Node 22.x 的 `node:sqlite` 为实验特性，需 `--experimental-sqlite`
 * 标志启用（Node 23.4+ / 24 已免标志但仍发实验警告，传该标志无害）。SQLiteAdapter.connect()
 * 经 `IS_DENO || IS_NODE` 分支走 `node:sqlite` 的 DatabaseSync。
 *
 * 【范围】仅跑 tests/sqlite/（19 文件，自包含，无外部 DB 服务、无 locale 断言）。
 * postgresql/mysql/mongo/integration 需真实 DB 服务，拆为 `test:integration` 本地运行。
 *
 * 【Invariant】One file per process invocation; exit code is the single source of truth.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

// 显式置 CI=true：使脚本自包含，不依赖 Unix shell 前缀语法（Windows 不支持）。
process.env.CI = "true";

const testDir = resolve("tests", "sqlite");
const files = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort()
  .map((f) => join(testDir, f));

console.log(`Found ${files.length} SQLite test files\n`);

let failed = 0;
for (const file of files) {
  const rel = file.replace(process.cwd() + "/", "");
  console.log(`▶ ${rel}`);
  const result = spawnSync(
    process.execPath,
    ["--experimental-sqlite", "--import", "tsx", "--test-force-exit", file],
    {
      stdio: "inherit",
      env: { ...process.env, CI: "true" },
    },
  );
  if (result.status !== 0) {
    failed++;
    console.error(`✗ FAILED: ${rel}\n`);
  } else {
    console.log(`✓ ${rel}\n`);
  }
}

console.log("=".repeat(60));
if (failed > 0) {
  console.error(`✗ ${failed}/${files.length} test file(s) failed`);
  process.exit(1);
}
console.log(`✓ All ${files.length} test files passed`);
