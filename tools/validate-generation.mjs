#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const result = { projectDir: argv[0] || "", provider: "" };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--provider") {
      result.provider = argv[++index] || "";
    }
  }
  return result;
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function walkStrings(value, visitor, trail = "$") {
  if (typeof value === "string") {
    visitor(value, trail);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visitor, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      walkStrings(child, visitor, `${trail}.${key}`),
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.projectDir) {
    console.error("用法: node tools/validate-generation.mjs projects/<项目> [--provider <id>]");
    process.exit(2);
  }
  const projectDir = path.resolve(process.cwd(), args.projectDir);
  const planPath = path.join(projectDir, "generation", "plan.json");
  if (!fs.existsSync(planPath)) {
    fail(`缺少生成计划：${planPath}`);
    report();
    return;
  }
  const plan = readJson(planPath);
  const registry = readJson(path.join(repoRoot, "providers", "registry.json"));
  const providerIds = new Set((registry.providers || []).map((item) => item.id));
  const project = fs.existsSync(path.join(projectDir, "project.json"))
    ? readJson(path.join(projectDir, "project.json"))
    : {};

  if (plan.schema !== "short-drama-generation/v1") {
    fail("plan.schema 必须是 short-drama-generation/v1");
  }
  if (!/^[a-z0-9][a-z0-9-]+$/.test(plan.project_id || "")) {
    fail("project_id 只能使用小写字母、数字和 ASCII 连字符");
  }
  if (!plan.source_script || /[\\/]/.test(plan.source_script)) {
    fail("source_script 只能写文件名，例如 章01_镜头剧本.md");
  }
  if (!providerIds.has(plan.default_provider)) {
    fail(`未知默认 provider：${plan.default_provider}`);
  }
  for (const [unitId, provider] of Object.entries(plan.unit_overrides || {})) {
    if (!providerIds.has(provider)) {
      fail(`${unitId} 覆盖了未知 provider：${provider}`);
    }
  }
  if (!Array.isArray(plan.units) || !plan.units.length) {
    fail("plan.units 不能为空");
  }

  walkStrings(plan, (value, trail) => {
    if (/[A-Za-z]:[\\/]/.test(value) || /^\/(Users|home|mnt)\//.test(value)) {
      fail(`发现绝对路径：${trail}`);
    }
  });

  const unitIds = new Set();
  for (const unit of plan.units || []) {
    if (!/^U[0-9]{2}$/.test(unit.id || "")) {
      fail(`单元 ID 不合法：${unit.id}`);
    }
    if (unitIds.has(unit.id)) {
      fail(`单元 ID 重复：${unit.id}`);
    }
    unitIds.add(unit.id);
    if (!Number.isFinite(unit.duration_sec) || unit.duration_sec <= 0) {
      fail(`${unit.id} duration_sec 必须大于 0`);
    }
    const shots = unit.shots || [];
    if (unit.duration_sec === 10 && (shots.length < 2 || shots.length > 4)) {
      fail(`${unit.id} 10 秒单元必须有 2-4 个镜头，实际 ${shots.length}`);
    }
    if (unit.duration_sec === 15 && (shots.length < 3 || shots.length > 5)) {
      fail(`${unit.id} 15 秒单元必须有 3-5 个镜头，实际 ${shots.length}`);
    }
    for (const shot of shots) {
      if (shot.start_sec < 0 || shot.end_sec > unit.duration_sec) {
        fail(`${unit.id} Shot ${shot.id} 超出单元时长`);
      }
      if (shot.end_sec <= shot.start_sec) {
        fail(`${unit.id} Shot ${shot.id} 时间范围无效`);
      }
    }
    for (const segment of unit.segments || []) {
      if (
        segment.start_sec < 0 ||
        segment.end_sec > unit.duration_sec ||
        segment.end_sec <= segment.start_sec
      ) {
        fail(`${unit.id} 分段 ${segment.id} 时间范围无效`);
      }
    }
    const castIds = new Set((unit.cast || []).map((item) => item.id));
    for (const line of unit.dialogue || []) {
      if (!castIds.has(line.speaker_id)) {
        warn(`${unit.id} 对白说话人 ${line.speaker_id} 不在出场表中`);
      }
    }
    if (!(unit.references || []).length) {
      warn(`${unit.id} 没有参考素材；请确认这是有意为之`);
    }
    const slots = (unit.audio || []).map((item) => item.slot);
    slots.forEach((slot, index) => {
      if (slot !== index + 1) {
        fail(`${unit.id} Audio 槽位必须从 1 连续递增`);
      }
    });

    const providerId =
      args.provider ||
      plan.unit_overrides?.[unit.id] ||
      plan.default_provider;
    const entry = (registry.providers || []).find((item) => item.id === providerId);
    if (!entry) {
      fail(`${unit.id} 使用了未知 provider：${providerId}`);
      continue;
    }
    const profile = readJson(path.join(repoRoot, entry.path));
    const capabilities = profile.capabilities || {};
    if (capabilities.max_image_refs != null) {
      if ((unit.references || []).length > capabilities.max_image_refs) {
        fail(
          `${unit.id} 参考素材 ${unit.references.length} 个，超过 ${providerId} 上限 ${capabilities.max_image_refs}`,
        );
      }
    }
    if (capabilities.max_audio_refs != null) {
      if ((unit.audio || []).length > capabilities.max_audio_refs) {
        fail(
          `${unit.id} 音频 ${unit.audio.length} 路，超过 ${providerId} 上限 ${capabilities.max_audio_refs}`,
        );
      }
    }
    if (capabilities.aspect_ratios?.length) {
      const aspect = project.format?.aspect_ratio;
      if (aspect && !capabilities.aspect_ratios.includes(aspect)) {
        fail(
          `${unit.id} 项目画幅 ${aspect} 不被 ${providerId} 支持（${capabilities.aspect_ratios.join("/")}）`,
        );
      }
    }
    if (entry.compiler === null) {
      warn(`${unit.id} 使用 legacy provider ${providerId}，第一版不生成新提示词包`);
    }
  }
  report();
}

function report() {
  const planPath = path.resolve(
    process.cwd(),
    process.argv[2] || "",
    "generation",
    "plan.json",
  );
  if (errors.length) {
    console.error(`GENERATION_VALIDATION_FAILED ${planPath}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    for (const warning of warnings) {
      console.warn(`- WARN ${warning}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`GENERATION_VALIDATION_OK ${planPath}`);
  for (const warning of warnings) {
    console.log(`- WARN ${warning}`);
  }
}

main();
