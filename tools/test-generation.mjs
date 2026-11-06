import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function makePlan(provider, references = 1) {
  const refs = Array.from({ length: references }, (_, index) => ({
    number: index + 1,
    id: `DR-${String(index + 1).padStart(2, "0")}`,
    name: `角色${index + 1}`,
    kind: "character",
  }));
  return {
    schema: "short-drama-generation/v1",
    project_id: "test-project",
    source_script: "章01_镜头剧本.md",
    default_provider: provider,
    unit_overrides: {},
    warnings: [],
    units: [
      {
        id: "U01",
        duration_sec: 15,
        time: "00:00-00:15",
        segments: [
          { id: "A", start_sec: 0, end_sec: 10 },
          { id: "B", start_sec: 10, end_sec: 15 },
        ],
        shots: [
          {
            id: 1,
            start_sec: 0,
            end_sec: 5,
            shot_size: "中景",
            action: "角色1看向蛋糕",
            cut_reason: "空间建立",
          },
          {
            id: 2,
            start_sec: 5,
            end_sec: 10,
            shot_size: "特写",
            action: "角色1伸手",
            cut_reason: "动作递进",
          },
          {
            id: 3,
            start_sec: 10,
            end_sec: 15,
            shot_size: "近景",
            action: "角色1接过蛋糕",
            cut_reason: "状态变化",
          },
        ],
        cast: [{ id: "DR-01", name: "角色1" }],
        scene: "SCENE_01 甜品店",
        assets: [],
        references: refs,
        audio: [
          {
            slot: 1,
            speaker_id: "DR-01",
            name: "角色1",
            duration_sec: 3.5,
            file_name: "DR-01_声线.wav",
          },
        ],
        dialogue: [
          {
            speaker_id: "DR-01",
            mode: "on_screen",
            text: "一个。",
            start_sec: 2,
            end_sec: 4,
          },
        ],
        sound: "环境底噪",
        change: "角色1从期待到开心",
        entry_anchor: "角色1站在柜台前",
        exit_anchor: "角色1抱着礼盒",
        trigger: "TRIG_01 付款完成",
        link: "本集开场",
        declared_split: "A 00:00-00:10｜B 00:10-00:15",
      },
    ],
  };
}

test("generic and seedance compile a 15s plan without H3 tags", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sd-generation-test-"));
  const planDir = path.join(dir, "generation");
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(
    path.join(planDir, "plan.json"),
    JSON.stringify(makePlan("generic-video"), null, 2),
    "utf8",
  );
  const result = run("tools/compile-generation.mjs", [dir, "--provider", "generic-video"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const prompt = fs.readFileSync(
    path.join(planDir, "providers", "generic-video", "U01_prompt.md"),
    "utf8",
  );
  assert.match(prompt, /通用视频提示词包/);
  assert.doesNotMatch(prompt, /subject_definitions|retention_analysis|<Audio/);
  assert.doesNotMatch(prompt, /[A-Za-z]:[\\/]/);

  const seedance = run("tools/compile-generation.mjs", [
    dir,
    "--provider",
    "seedance-2.5",
  ]);
  assert.equal(seedance.status, 0, seedance.stderr || seedance.stdout);
  const seedanceRequest = JSON.parse(
    fs.readFileSync(
      path.join(planDir, "providers", "seedance-2.5", "U01_request.json"),
      "utf8",
    ),
  );
  assert.equal(seedanceRequest.provider, "seedance-2.5");
  assert.equal(seedanceRequest.segments.length, 2);
});

test("legacy minimax-h3 is explicit and not silently compiled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sd-generation-test-"));
  const planDir = path.join(dir, "generation");
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(
    path.join(planDir, "plan.json"),
    JSON.stringify(makePlan("minimax-h3"), null, 2),
    "utf8",
  );
  const result = run("tools/compile-generation.mjs", [dir, "--provider", "minimax-h3"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /legacy provider/);
});

test("validation rejects reference overflow instead of truncating", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sd-generation-test-"));
  const planDir = path.join(dir, "generation");
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(
    path.join(planDir, "plan.json"),
    JSON.stringify(makePlan("minimax-h3", 10), null, 2),
    "utf8",
  );
  const result = run("tools/validate-generation.mjs", [dir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /上限 9/);
});
