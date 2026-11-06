#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function resolveProjectFile(input) {
  if (!input) {
    throw new Error("用法: node tools/render-project.mjs <项目目录或 project.json>");
  }
  const resolved = path.resolve(process.cwd(), input);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, "project.json");
  }
  return resolved;
}

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function list(items) {
  return (items || []).length
    ? items.map((item) => `- ${item}`).join("\n")
    : "- 无";
}

function deliveryText(value) {
  return (
    {
      on_screen: "画内",
      off_screen: "画外",
      voice_over: "旁白",
    }[value] || value
  );
}

function tierText(value) {
  return (
    {
      core: "核心",
      key: "关键",
      function: "功能",
      voice: "画外",
      mentioned: "仅提及",
      nonhuman: "非人",
      variant: "变体",
    }[value] || value
  );
}

function main() {
  const filePath = resolveProjectFile(process.argv[2]);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到项目文件: ${filePath}`);
  }
  const project = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const outputPath = path.join(path.dirname(filePath), "项目档.md");
  const format = project.format || {};
  const rights = project.rights || {};
  const story = project.story || {};
  const production = project.production || {};
  const confirmation = project.confirmation || {};

  const lines = [];
  lines.push("---");
  lines.push(`title: ${project.title} - 开场确认`);
  lines.push("type: project-kickoff");
  lines.push("kind: project-kickoff");
  lines.push("schema: short-drama-project/v1");
  lines.push(`project_id: ${project.project_id}`);
  lines.push("episode_id: S01E01");
  lines.push(`status: ${project.status}`);
  lines.push(`lock_status: ${confirmation.lock_status}`);
  lines.push(`rights_status: ${confirmation.rights_status}`);
  lines.push(`source: ${project.source?.tool || ""}`);
  lines.push(`updated_at: ${project.updated_at || ""}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${project.title}｜项目档`);
  lines.push("");
  lines.push("> 本文件由 `project.json` 自动生成，不是主数据。修改请改 `project.json` 后重新渲染。");
  lines.push("");
  lines.push("## 1. 项目事实");
  lines.push("");
  lines.push("| 项目 | 值 |");
  lines.push("|---|---|");
  lines.push(`| 项目 ID | ${cell(project.project_id)} |`);
  lines.push(`| 作品类型 | ${cell(rights.work_type)} |`);
  lines.push(`| 来源 IP | ${cell(rights.source_ip)} |`);
  lines.push(`| 平台 | ${cell(format.platform)} |`);
  lines.push(`| 总时长 | ${cell(format.duration_sec)} 秒 |`);
  lines.push(`| 单元结构 | ${cell(format.unit_count)} × ${cell(format.unit_seconds)} 秒 |`);
  lines.push(`| 画幅 | ${cell(format.aspect_ratio)}；${cell(format.resolution)}；${cell(format.fps)} FPS |`);
  lines.push(`| 画幅说明 | ${cell(format.aspect_ratio_note || "-")} |`);
  lines.push(`| 语言 | ${cell(format.language)} |`);
  lines.push(`| 字幕 | ${cell(format.subtitles)} |`);
  lines.push(`| BGM | ${cell(format.bgm)} |`);
  lines.push(`| 受众 | ${cell(format.audience)} |`);
  lines.push(`| 类型与情绪 | ${cell(format.genre)} |`);
  lines.push("");
  lines.push("## 2. 版权与素材锁");
  lines.push("");
  lines.push(`- 整体状态：${rights.status}`);
  lines.push(`- 原作使用范围：${rights.original_scope}`);
  lines.push(`- 角色使用边界：${rights.character_scope}`);
  lines.push(`- 平台规则：${rights.platform_rules}`);
  lines.push("");
  lines.push("| 素材 | 生成方式 | 授权状态 | 说明 |");
  lines.push("|---|---|---|---|");
  for (const [name, value] of [
    ["音乐", rights.music],
    ["字体", rights.fonts],
    ["图片", rights.images],
    ["视频", rights.video],
  ]) {
    lines.push(
      `| ${name} | ${cell(value?.mode)} | ${cell(value?.license_status)} | ${cell(value?.note || "-")} |`,
    );
  }
  lines.push(
    `| AI 素材 | ${rights.ai_assets?.allowed ? "允许" : "不允许"} | - | ${cell(rights.ai_assets?.note || "-")} |`,
  );
  lines.push(
    `| 署名 | - | ${cell(rights.attribution?.status)} | ${cell(rights.attribution?.text || "待补充")} |`,
  );
  lines.push("");
  lines.push("## 3. 故事事实锁");
  lines.push("");
  lines.push(`- 一句话故事：${story.logline}`);
  lines.push(`- 主角目标：${story.protagonist_goal}`);
  lines.push(`- 核心冲突：${story.core_conflict}`);
  lines.push(`- 反转：${story.reversal}`);
  lines.push(`- 结局：${story.ending}`);
  lines.push(`- 世界规则：${story.world_rules}`);
  lines.push(`- 时间线：${story.timeline}`);
  lines.push(`- 地点：${(story.locations || []).join("；")}`);
  lines.push("");
  lines.push("### 事件顺序锁");
  lines.push("");
  lines.push((story.event_order || []).map((item, index) => `${index + 1}. ${item}`).join("\n"));
  lines.push("");
  lines.push("### 台词锁");
  lines.push("");
  lines.push("| 编号 | 说话人 | 画内/画外 | 台词 | 状态 |");
  lines.push("|---|---|---|---|---|");
  for (const line of story.must_lines || []) {
    lines.push(
      `| ${cell(line.id)} | ${cell(line.speaker)} | ${cell(deliveryText(line.delivery))} | “${cell(line.text)}” | ${cell(line.status)} |`,
    );
  }
  lines.push("");
  lines.push("### 禁止新增");
  lines.push("");
  lines.push(list(story.forbidden_changes));
  lines.push("");
  lines.push("## 4. 人物分层总表");
  lines.push("");
  lines.push("| 显示名 | 机器 ID | 层级 | 关系 | 出场 | 说话 | 视觉锁 | 声线锁 | 参考图 | 授权 | 状态 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const character of project.characters || []) {
    lines.push(
      `| ${cell(character.display_name)} | ${cell(character.id)} | ${cell(tierText(character.tier))} | ${cell(character.relationship)} | ${cell(character.appears_in)} | ${character.speaks ? "是" : "否"} | ${cell(character.visual_lock?.status)} | ${cell(character.voice_lock?.status)} | ${cell(character.references?.status)} | ${cell(character.rights_status)} | ${cell(character.lock_status)} |`,
    );
  }
  for (const crowd of project.crowd_groups || []) {
    lines.push(
      `| ${cell(crowd.display_name)} | ${cell(crowd.id)} | 群演 | ${cell(crowd.description)} | ${cell(crowd.appears_in)} | ${crowd.speaks ? "是" : "否"} | ${cell(crowd.visual_status)} | 不需要 | ${cell(crowd.reference_status)} | - | ${cell(crowd.lock_status)} |`,
    );
  }
  lines.push("");
  lines.push("## 5. 人物确认卡");
  for (const character of project.characters || []) {
    lines.push("");
    lines.push(`### ${character.display_name}｜${character.id}`);
    lines.push("");
    lines.push(`- 层级：${tierText(character.tier)}`);
    lines.push(`- 关系：${character.relationship}`);
    lines.push(`- 出场：${character.appears_in}`);
    lines.push(`- 视觉锁：${character.visual_lock?.description || "-"}`);
    lines.push(`- 视觉必须保留：${(character.visual_lock?.must_keep || []).join("；")}`);
    lines.push(`- 视觉禁止变化：${(character.visual_lock?.forbidden_changes || []).join("；")}`);
    lines.push(`- 表演锁：${character.performance_lock || "-"}`);
    lines.push(`- 声音锁：${character.voice_lock?.description || "-"}`);
    lines.push(`- 声线文件：${character.voice_lock?.file || "待补"}`);
    lines.push(`- 连续性：${character.continuity || "-"}`);
    lines.push(`- 变体：${(character.variants || []).join("；") || "无"}`);
    lines.push(`- 参考图：${character.references?.status || "-"}；${(character.references?.items || []).join("；") || "待补"}`);
    lines.push(`- 授权状态：${character.rights_status}`);
    lines.push(`- 锁定状态：${character.lock_status}`);
  }
  lines.push("");
  lines.push("## 6. 场景、道具、群演与文字锁");
  lines.push("");
  lines.push("### 场景");
  lines.push("");
  lines.push("| 显示名 | 机器 ID | 空间 | 光线 | 可复用 | 参考图 | 状态 |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const scene of project.scenes || []) {
    lines.push(
      `| ${cell(scene.display_name)} | ${cell(scene.id)} | ${cell(scene.layout)} | ${cell(scene.lighting)} | ${scene.reusable ? "是" : "否"} | ${cell(scene.reference_status)} | ${cell(scene.lock_status)} |`,
    );
  }
  lines.push("");
  lines.push("### 道具与触发");
  lines.push("");
  lines.push("| 显示名 | 机器 ID | 持有者 | 形态变化 | 触发 | 占参考图 | 状态 |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const prop of project.props || []) {
    lines.push(
      `| ${cell(prop.display_name)} | ${cell(prop.id)} | ${cell(prop.holder)} | ${cell(prop.state_changes)} | ${cell(prop.trigger)} | ${prop.uses_reference ? "是" : "否"} | ${cell(prop.lock_status)} |`,
    );
  }
  lines.push("");
  lines.push("### 触发");
  lines.push("");
  lines.push("| 机器 ID | 名称 | 条件 | 效果 |");
  lines.push("|---|---|---|---|");
  for (const trigger of project.triggers || []) {
    lines.push(
      `| ${cell(trigger.id)} | ${cell(trigger.name)} | ${cell(trigger.condition)} | ${cell(trigger.effect)} |`,
    );
  }
  lines.push("");
  lines.push("### 群演");
  lines.push("");
  lines.push("| 显示名 | 机器 ID | 说明 | 出场 | 视觉 | 参考图 | 状态 |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const crowd of project.crowd_groups || []) {
    lines.push(
      `| ${cell(crowd.display_name)} | ${cell(crowd.id)} | ${cell(crowd.description)} | ${cell(crowd.appears_in)} | ${cell(crowd.visual_status)} | ${cell(crowd.reference_status)} | ${cell(crowd.lock_status)} |`,
    );
  }
  lines.push("");
  lines.push("### 场景风格锁");
  lines.push("");
  for (const scene of project.scenes || []) {
    lines.push(`- ${scene.id}：${scene.style_lock}`);
  }
  lines.push("");
  lines.push("## 7. 声音与后期锁");
  lines.push("");
  lines.push("- 对白：有；中文");
  lines.push(`- BGM：${format.bgm}`);
  lines.push("- 环境声：甜品店轻微环境底噪");
  lines.push("- 动作声：手指敲玻璃、小跑脚步、礼盒抓取摩擦等轻音效");
  lines.push("- 混音目标：人声优先，符合小红书短视频响度标准");
  lines.push("- 字幕：硬字幕，仅三句台词；无片头片尾");
  lines.push("");
  lines.push("## 8. 生产参数");
  lines.push("");
  lines.push("| 项目 | 值 |");
  lines.push("|---|---|");
  lines.push(`| 资产模式 | ${cell(production.asset_mode)} |`);
  lines.push(`| 失败策略 | ${cell(production.failure_policy)} |`);
  lines.push(`| 项目根 | ${cell(production.project_root)} |`);
  lines.push(`| 媒体根 | ${cell(production.media_root)} |`);
  lines.push(`| 模型/工作流版本 | ${cell(production.model_workflow_version || "待填写")} |`);
  lines.push(`| 已有项目 ID | ${cell(production.existing_project_id)} |`);
  for (const [key, value] of Object.entries(production.file_patterns || {})) {
    lines.push(`| ${cell(key)} | \`${cell(value)}\` |`);
  }
  lines.push("");
  lines.push("## 9. 确认汇总");
  lines.push("");
  lines.push(`- 锁定状态：${confirmation.lock_status}`);
  lines.push(`- 版权状态：${confirmation.rights_status}`);
  lines.push("");
  lines.push("### 已确认");
  lines.push(list(confirmation.confirmed));
  lines.push("");
  lines.push("### 待确认");
  lines.push(list(confirmation.pending));
  lines.push("");
  lines.push("### 禁止改动");
  lines.push(list(confirmation.forbidden));
  lines.push("");
  lines.push("### 变更记录");
  lines.push("");
  lines.push("| 日期 | 改动 | 影响 | 确认人 |");
  lines.push("|---|---|---|---|");
  for (const entry of confirmation.change_log || []) {
    lines.push(
      `| ${cell(entry.date)} | ${cell(entry.change)} | ${cell(entry.impact)} | ${cell(entry.actor)} |`,
    );
  }
  lines.push("");
  lines.push("## 10. 媒体清单");
  lines.push("");
  if ((project.media_manifest || []).length) {
    lines.push("| 类型 | 相对路径 | 状态 |");
    lines.push("|---|---|---|");
    for (const item of project.media_manifest) {
      lines.push(`| ${cell(item.type)} | \`${cell(item.path)}\` | ${cell(item.status)} |`);
    }
  } else {
    lines.push("暂无媒体文件；图片、音频和视频不进入 Git。");
  }
  lines.push("");
  lines.push("## 11. 源数据");
  lines.push("");
  lines.push(`- 确认工具：${project.source?.tool || "-"}`);
  lines.push(`- 确认日期：${project.source?.confirmed_at || "-"}`);
  lines.push(`- 说明：${project.source?.note || "-"}`);
  lines.push("");

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`RENDERED ${outputPath}`);
}

main();
