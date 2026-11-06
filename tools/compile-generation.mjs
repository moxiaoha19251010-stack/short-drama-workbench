#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = { projectDir: argv[0] || "", provider: "", unit: "" };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--provider") {
      result.provider = argv[++index] || "";
    } else if (arg === "--unit") {
      result.unit = argv[++index] || "";
    }
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertRelativePayload(value, trail = "$") {
  if (typeof value === "string") {
    if (/[A-Za-z]:[\\/]/.test(value) || /^\/(Users|home|mnt)\//.test(value)) {
      throw new Error(`输出包含绝对路径：${trail}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertRelativePayload(item, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      assertRelativePayload(child, `${trail}.${key}`),
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.projectDir) {
    console.error(
      "用法: node tools/compile-generation.mjs projects/<项目> [--provider <id>] [--unit U01]",
    );
    process.exit(2);
  }

  const projectDir = path.resolve(process.cwd(), args.projectDir);
  const planPath = path.join(projectDir, "generation", "plan.json");
  if (!fs.existsSync(planPath)) {
    throw new Error(`缺少生成计划：${planPath}。先运行 build-generation-plan.mjs。`);
  }
  const plan = readJson(planPath);
  const registry = readJson(path.join(repoRoot, "providers", "registry.json"));
  const projectPath = path.join(projectDir, "project.json");
  const project = fs.existsSync(projectPath) ? readJson(projectPath) : {};
  const selectedUnits = plan.units.filter(
    (unit) => !args.unit || unit.id === args.unit,
  );
  if (!selectedUnits.length) {
    throw new Error(`找不到单元：${args.unit || "(全部)"}`);
  }

  const compileManifest = {
    schema: "short-drama-compile-manifest/v1",
    project_id: plan.project_id,
    units: [],
  };

  for (const unit of selectedUnits) {
    const providerId =
      args.provider ||
      plan.unit_overrides?.[unit.id] ||
      plan.default_provider ||
      registry.default;
    const providerEntry = (registry.providers || []).find(
      (item) => item.id === providerId,
    );
    if (!providerEntry) {
      throw new Error(`未知 provider：${providerId}`);
    }
    if (!providerEntry.compiler) {
      throw new Error(
        `${providerId} 第一版是 legacy provider，不接管旧 H3 包；请继续使用现有 H3 工具，或选择 generic-video/seedance-2.5。`,
      );
    }
    const providerProfile = readJson(
      path.join(repoRoot, providerEntry.path),
    );
    const compilerPath = path.join(repoRoot, providerEntry.compiler);
    const compiler = await import(pathToFileURL(compilerPath).href);
    if (typeof compiler.compile !== "function") {
      throw new Error(`provider ${providerId} 的 compiler 没有导出 compile()`);
    }
    const result = compiler.compile(unit, {
      provider: providerId,
      provider_profile: providerProfile,
      project_id: plan.project_id,
      project: {
        project_id: project.project_id || plan.project_id,
        format: project.format || {},
      },
    });
    assertRelativePayload(result);

    const outputDir = path.join(
      projectDir,
      "generation",
      "providers",
      providerId,
    );
    fs.mkdirSync(outputDir, { recursive: true });
    const promptPath = path.join(outputDir, `${unit.id}_prompt.md`);
    const requestPath = path.join(outputDir, `${unit.id}_request.json`);
    fs.writeFileSync(promptPath, `${result.prompt}\n`, "utf8");
    fs.writeFileSync(
      requestPath,
      `${JSON.stringify(result.request, null, 2)}\n`,
      "utf8",
    );
    compileManifest.units.push({
      unit: unit.id,
      provider: providerId,
      prompt: path.relative(repoRoot, promptPath).replaceAll("\\", "/"),
      request: path.relative(repoRoot, requestPath).replaceAll("\\", "/"),
    });
  }

  const manifestPath = path.join(projectDir, "generation", "compile-manifest.json");
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(compileManifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`COMPILED ${manifestPath}`);
  for (const item of compileManifest.units) {
    console.log(`- ${item.unit} -> ${item.provider}`);
  }
}

main().catch((error) => {
  console.error(`COMPILE_FAILED ${error.message}`);
  process.exit(1);
});
