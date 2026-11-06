#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const requiredTopLevel = [
  "schema",
  "project_id",
  "title",
  "status",
  "source",
  "format",
  "rights",
  "story",
  "audio",
  "characters",
  "scenes",
  "props",
  "crowd_groups",
  "triggers",
  "production",
  "confirmation",
  "media_manifest",
];

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function resolveProjectFile(input) {
  const resolved = path.resolve(process.cwd(), input || "");
  if (!input) {
    throw new Error("用法: node tools/validate-project.mjs <项目目录或 project.json>");
  }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, "project.json");
  }
  return resolved;
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
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, visitor, `${trail}.${key}`);
    }
  }
}

function main() {
  const filePath = resolveProjectFile(process.argv[2]);
  if (!fs.existsSync(filePath)) {
    fail(`找不到项目文件: ${filePath}`);
    return;
  }

  let project;
  try {
    project = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`JSON 无法解析: ${error.message}`);
    return;
  }

  for (const key of requiredTopLevel) {
    if (!(key in project)) {
      fail(`缺少顶层字段: ${key}`);
    }
  }

  if (project.schema !== "short-drama-project/v1") {
    fail("schema 必须是 short-drama-project/v1");
  }
  if (!/^[a-z0-9][a-z0-9-]+$/.test(project.project_id || "")) {
    fail("project_id 只能使用小写字母、数字和 ASCII 连字符");
  }
  if (!project.title) {
    fail("title 不能为空");
  }

  for (const forbiddenKey of ["template_for", "template_aliases", "template"]) {
    if (forbiddenKey in project) {
      fail(`项目实例不能包含模板字段: ${forbiddenKey}`);
    }
  }

  walkStrings(project, (value, trail) => {
    if (/[A-Za-z]:[\\/]/.test(value)) {
      fail(`发现绝对盘符路径: ${trail}`);
    }
    if (/^\/(Users|home|mnt)\//.test(value)) {
      fail(`发现绝对系统路径: ${trail}`);
    }
  });

  const format = project.format || {};
  if (
    Number(format.duration_sec) !==
    Number(format.unit_seconds) * Number(format.unit_count)
  ) {
    fail("format.duration_sec 必须等于 unit_seconds × unit_count");
  }
  if (format.aspect_ratio !== "9:16" && !format.aspect_ratio_note) {
    warn("非 9:16 画幅必须写 aspect_ratio_note 说明这是显式覆盖");
  }

  const rights = project.rights || {};
  const confirmation = project.confirmation || {};
  if (rights.status === "pending" && confirmation.lock_status === "locked") {
    fail("版权仍为 pending 时，confirmation.lock_status 不能是 locked");
  }
  if (confirmation.rights_status !== rights.status) {
    fail("confirmation.rights_status 必须与 rights.status 一致");
  }
  if (rights.music?.license_status === "pending" && !rights.music?.note) {
    warn("BGM 授权待确认，建议在 rights.music.note 写清待核实内容");
  }

  const characters = Array.isArray(project.characters) ? project.characters : [];
  const characterIds = new Set();
  for (const character of characters) {
    if (!/^DR-[0-9]{2}(_[A-Za-z0-9]+)?$/.test(character.id || "")) {
      fail(`角色 ID 不是 ASCII DR-## 格式: ${character.id}`);
    }
    if (character.id?.startsWith("DR-") && character.tier === "crowd") {
      fail(`群演不能使用角色 ID: ${character.id}`);
    }
    if (characterIds.has(character.id)) {
      fail(`角色 ID 重复: ${character.id}`);
    }
    characterIds.add(character.id);

    if (character.speaks) {
      const voice = character.voice_lock || {};
      if (voice.status === "complete" && !voice.file) {
        fail(`${character.id} 标了声线完整但没有声线文件`);
      }
      if (!voice.file && voice.status !== "pending") {
        fail(`${character.id} 没有声线文件时，voice_lock.status 必须是 pending`);
      }
    }

    const references = character.references || {};
    if (references.status === "complete" && !(references.items || []).length) {
      fail(`${character.id} 标了参考图完整但没有参考图`);
    }
  }

  const crowdGroups = Array.isArray(project.crowd_groups)
    ? project.crowd_groups
    : [];
  for (const crowd of crowdGroups) {
    if (!/^CROWD-[0-9]{2}$/.test(crowd.id || "")) {
      fail(`群演 ID 不是 ASCII CROWD-## 格式: ${crowd.id}`);
    }
    if (characterIds.has(crowd.id)) {
      fail(`群演 ID 不能与角色 ID 重复: ${crowd.id}`);
    }
  }

  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  for (const scene of scenes) {
    if (!/^SCENE_[0-9]{2}[a-z]?$/.test(scene.id || "")) {
      fail(`场景 ID 不是 ASCII SCENE_## 格式: ${scene.id}`);
    }
  }

  const props = Array.isArray(project.props) ? project.props : [];
  for (const prop of props) {
    if (!/^PROP_[0-9]{2}$/.test(prop.id || "")) {
      fail(`道具 ID 不是 ASCII PROP_## 格式: ${prop.id}`);
    }
  }

  const triggers = Array.isArray(project.triggers) ? project.triggers : [];
  for (const trigger of triggers) {
    if (!/^TRIG_[0-9]{2}$/.test(trigger.id || "")) {
      fail(`触发 ID 不是 ASCII TRIG_## 格式: ${trigger.id}`);
    }
  }

  const story = project.story || {};
  const mustLines = Array.isArray(story.must_lines) ? story.must_lines : [];
  if (!mustLines.length) {
    fail("story.must_lines 不能为空");
  }
  for (const line of mustLines) {
    if (!line.text) {
      fail(`${line.id || "未知台词"} 缺少逐字台词`);
    }
    if (!characterIds.has(line.speaker_id)) {
      fail(`${line.id || "未知台词"} 的 speaker_id 不在人物表中: ${line.speaker_id}`);
    }
  }
  if (!(story.event_order || []).length) {
    fail("story.event_order 不能为空");
  }

  const production = project.production || {};
  if (!["fail_fast", "auto_repair"].includes(production.failure_policy)) {
    fail("production.failure_policy 只能是 fail_fast 或 auto_repair");
  }
  if (production.failure_policy === "auto_repair") {
    warn("新项目默认应为 fail_fast；auto_repair 只用于明确批准的旧项目");
  }

  if (errors.length) {
    console.error(`VALIDATION_FAILED ${filePath}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    for (const warning of warnings) {
      console.warn(`- WARN ${warning}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`VALIDATION_OK ${filePath}`);
  for (const warning of warnings) {
    console.log(`- WARN ${warning}`);
  }
}

main();
