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
 * 【范围】默认仅跑 tests/sqlite/（自包含，无外部 DB 服务、无 locale 断言）。
 * 传入 `integration`（或显式目录）时跑 postgresql / mysql / mongo / integration，
 * 需真实 DB 服务；调用方式与默认 sqlite 相同（--experimental-sqlite --import tsx
 * --test-force-exit，一文件一进程）。
 *
 * 【Invariant】One file per process invocation; exit code is the single source of truth.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

// 显式置 CI=true：使脚本自包含，不依赖 Unix shell 前缀语法（Windows 不支持）。
process.env.CI = "true";

const INTEGRATION_DIRS = [
  "tests/postgresql",
  "tests/mysql",
  "tests/mongo",
  "tests/integration",
];

function collectTestFiles(dir) {
  const abs = resolve(dir);
  return readdirSync(abs)
    .filter((f) => f.endsWith(".test.ts"))
    .sort()
    .map((f) => join(abs, f));
}

const args = process.argv.slice(2);
let dirs;
if (args.length === 0) {
  dirs = ["tests/sqlite"];
} else if (args.length === 1 && args[0] === "integration") {
  dirs = INTEGRATION_DIRS;
} else {
  dirs = args;
}

const files = dirs.flatMap(collectTestFiles);
const label = dirs.length === 1 && dirs[0] === "tests/sqlite"
  ? "SQLite test files"
  : `test files (${dirs.join(", ")})`;

console.log(`Found ${files.length} ${label}\n`);

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
