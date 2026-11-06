function time(seconds) {
  const value = Number(seconds || 0);
  const minutes = Math.floor(value / 60);
  const rest = (value % 60).toFixed(3).replace(/\.?0+$/, "");
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function references(unit) {
  if (!unit.references?.length) {
    return "- 无";
  }
  return unit.references
    .map(
      (item) =>
        `- 参考 ${item.number}：${item.id} ${item.name}（${item.kind}）`,
    )
    .join("\n");
}

function audio(unit) {
  if (!unit.audio?.length) {
    return "- 无角色声线参考";
  }
  return unit.audio
    .map(
      (item) =>
        `- Audio ${item.slot}：${item.speaker_id} ${item.name}，${item.duration_sec}s，文件 ${item.file_name || "待补"}`,
    )
    .join("\n");
}

function dialogue(unit) {
  if (!unit.dialogue?.length) {
    return "- 无对白";
  }
  return unit.dialogue
    .map(
      (item) =>
        `- ${item.speaker_id}｜${item.mode === "off_screen" ? "画外" : "画内"}｜${item.start_sec ?? "?"}-${item.end_sec ?? "?"}s｜“${item.text}”`,
    )
    .join("\n");
}

function shots(unit) {
  return (unit.shots || [])
    .map(
      (shot) =>
        `- Shot ${shot.id}｜${time(shot.start_sec)}-${time(shot.end_sec)}｜${shot.shot_size}｜${shot.action}｜切镜理由：${shot.cut_reason}`,
    )
    .join("\n");
}

function buildPrompt(unit, context) {
  const project = context.project || {};
  const format = project.format || {};
  return [
    `# ${unit.id}｜${unit.duration_sec}s｜通用视频提示词包`,
    "",
    "## 项目约束",
    `- 画幅：${format.aspect_ratio || "未指定"}`,
    `- 分辨率：${format.resolution || "未指定"}`,
    `- 帧率：${format.fps || "未指定"} FPS`,
    `- 语言：${format.language || "未指定"}`,
    "- 画面不要生成字幕、文字、UI、logo 或水印；字幕和 BGM 在后期加入。",
    "",
    "## 单元",
    `- 时间：${unit.time || `${unit.duration_sec}s`}`,
    `- 出场：${(unit.cast || []).map((item) => `${item.id} ${item.name}`).join("；") || "无"}`,
    `- 场景：${unit.scene || "未指定"}`,
    `- 资产：${(unit.assets || []).map((item) => `${item.id} ${item.name}`).join("；") || "无"}`,
    `- 声音：${unit.sound || "未指定"}`,
    `- 画面变化：${unit.change || "未指定"}`,
    "",
    "## 参考素材",
    references(unit),
    "",
    "## 角色声线",
    audio(unit),
    "",
    "## 镜头动作",
    shots(unit),
    "",
    "## 对白",
    dialogue(unit),
    "",
    "## 连续性",
    `- 入口锚点：${unit.entry_anchor || "未指定"}`,
    `- 出口锚点：${unit.exit_anchor || "未指定"}`,
    `- 接续：${unit.link || "未指定"}`,
    `- 触发：${unit.trigger || "无"}`,
  ].join("\n");
}

export function compile(unit, context = {}) {
  const prompt = buildPrompt(unit, context);
  const request = {
    schema: "short-drama-generation-request/v1",
    provider: context.provider || "generic-video",
    project_id: context.project_id || context.project?.project_id || "",
    unit_id: unit.id,
    duration_sec: unit.duration_sec,
    segments: unit.segments || [],
    shots: unit.shots || [],
    cast: unit.cast || [],
    scene: unit.scene || "",
    assets: unit.assets || [],
    references: unit.references || [],
    audio: unit.audio || [],
    dialogue: unit.dialogue || [],
    sound: unit.sound || "",
    change: unit.change || "",
    entry_anchor: unit.entry_anchor || "",
    exit_anchor: unit.exit_anchor || "",
    trigger: unit.trigger || "",
    link: unit.link || "",
    prompt,
    notes: [
      "通用提示词包不包含任何厂商专属标签。",
      "参考素材、声线和镜头时间以本请求 JSON 为准；提示词用于人工复制或后续 API 编译。",
    ],
  };
  return { prompt, request };
}
