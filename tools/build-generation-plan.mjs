#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (!args.length) {
  console.error(
    "用法: node tools/build-generation-plan.mjs <项目目录> [--script 剧本] [--tools-root BasicMemory tools]",
  );
  process.exit(2);
}

const parser = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "parse-shot-script.py",
);
const python = process.env.PYTHON || "python";
const result = spawnSync(python, [parser, ...args], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`无法启动 Python: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
