---
permalink: basic-memory/game-short-video/原神/《若娜瓦的草莓蛋糕》/设定库/README
title: 设定库说明
type: note
schema: drama-v2
kind: settings-index
project_id: genshin-ronova-strawberry-cake
episode_id: S01E01
status: draft
version: 1
---

# 设定库说明

> 设定库不是 ComfyUI 专属。它是项目事实层：外部 AI 负责文字锁，Qwen 图像流负责四视图/场景，人工负责验收和登记。

## 当前文件

- `场景风格锁.md`
- `角色画像锁.md`
- `角色音频锁.md`
- `资产清单.md`
- `资产清单_粘贴版.txt`
- `世界与角色.md`
- `project_profile.json`

## 把资产清单发给外部 AI

1. 不要上传整个 `媒体素材` 或 `设定库` 文件夹。
2. 优先上传 `资产清单_粘贴版.txt`；如果豆包不接受附件，就打开这个文件全选复制，直接粘进对话。
3. 也可以上传 `资产清单.md`，但它带 frontmatter，外部 AI 容易把属性一起复制；纯文本版更稳。
4. 上传后让 AI 只读取 ID、名称、类型、路径和状态，不要重新扫描文件夹。

媒体文件变化后，在 Obsidian 运行“扫描媒体素材”，会自动重写 `资产清单.md` 和 `资产清单_粘贴版.txt`。

## 状态规则

- `pending`：没有真实文件或尚未验证。
- `partial`：文件已存在，但尚未人工验收。
- `approved`：人工确认可用。
- `locked`：锁文本和对应资产都已确认。
