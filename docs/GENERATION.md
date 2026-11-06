# 通用视频生成层

## 目标

把“镜头剧本”与具体视频模型分开。镜头剧本继续使用原来的严格格式；生成层只做三件事：

1. 读取 `章01_镜头剧本.md`，生成模型无关的 `generation/plan.json`。
2. 按 provider 能力编译成提示词包和请求 JSON。
3. 人工或已有 ComfyUI/API 执行生成，结果写入 `generation/results/manifest.json`。

## 不改变的东西

- `章01_镜头剧本.md` 的文件名、段落、字段顺序。
- `## 0. 角色音频锁` 和每单元 `角色音频` 行。
- `unit_audio.py`、金鱼“单元音频”面板、H3 runner 和现有 H3 产物。

## 生成计划

```text
node tools/build-generation-plan.mjs projects/<项目>
```

输出：

```text
projects/<项目>/generation/plan.json
```

计划是派生文件，不手工修改。修改剧本后重新生成。

## 编译 provider

```text
node tools/compile-generation.mjs projects/<项目> --provider generic-video
node tools/compile-generation.mjs projects/<项目> --provider seedance-2.5
```

输出：

```text
projects/<项目>/generation/providers/<provider>/U01_prompt.md
projects/<项目>/generation/providers/<provider>/U01_request.json
```

`generic-video` 是任何新模型的兜底提示词包。`seedance-2.5` 首版为手动 profile，具体能力待官方文档核实。`minimax-h3` 第一版保持旧链，不由新编译器接管。

## 选择模型

`project.json` 中：

```json
"generation": {
  "default_provider": "generic-video",
  "unit_overrides": {
    "U03": "seedance-2.5"
  },
  "prompt_enhancer": "none"
}
```

项目默认 provider 可以被子单元覆盖。

## 新增 provider

新增：

```text
providers/<id>/provider.json
providers/<id>/compiler.mjs
```

在 `providers/registry.json` 注册后，即可用 `--provider <id>` 编译。能力未知的 provider 先把 `capabilities` 写成 `null`，不要猜。

## 校验

```text
node tools/validate-generation.mjs projects/<项目>
```

校验会检查：剧本字段、镜头时间、Audio 槽位、参考素材、绝对路径，以及已知 provider 的素材上限。
