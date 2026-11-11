# 短剧项目包工作区

这是跨电脑使用的短剧项目包仓库。每个项目至少有两个核心文件：

- `project.json`：唯一主数据，机器和工作台读取。
- `项目档.md`：由 JSON 自动生成的中文项目档，给人阅读，不是主数据。

创作阶段的 `创作蓝图.md`、`故事地图.md`、`章01_镜头剧本.md`、`设定库/`、`H3/`、`交接/` 和 `记录/验收记录.md` 也会同步到项目目录；媒体和剪辑工程不进入 Git。

媒体文件不进入 Git。图片、音频、视频放在独立媒体目录，项目 JSON 只记录相对路径和媒体清单。

## Basic Memory 主库与项目链接

项目文本的唯一维护位置是 Basic Memory：

```text
C:\Basic Memory short-video\game-short-video\<游戏分类>\《项目名》\
```

本仓库的 `projects/<项目>` 应作为该目录的 Windows junction，而不是另建一份实体副本。Git 会跟随 junction 读取并提交目标中的文本，GitHub Actions 看到的是普通项目路径。

不把整个 `projects` 根目录直接链接到 `game-short-video`：该库还包含其他作品、媒体和剪辑工程，按项目建立 junction 才能限制 Git 和 Actions 的处理范围。

新电脑 clone 后，如果 `projects/<项目>` 是普通目录，先确认没有未提交改动，再替换为 junction：

```powershell
$project = "项目名"
$repo = "C:\Users\莫小哈\Documents\Codex\short-drama-workbench"
$target = "C:\Basic Memory short-video\game-short-video\<游戏分类>\《$project》"
$link = Join-Path $repo "projects\$project"

# 仅在 $link 的文本已与 $target 完全一致后执行
Remove-Item -Recurse -Force -LiteralPath $link
New-Item -ItemType Junction -Path $link -Target $target
```

不要在链接目标之外另改仓库副本，否则会出现 Basic Memory 与 GitHub 两套内容。

## 日常使用

仓库地址：

```text
https://github.com/moxiaoha19251010-stack/short-drama-workbench
```

1. 在任意电脑打开上面的 GitHub 仓库。
2. 打开 `projects/<项目>/项目档.md`，这是给人看的中文项目档。
3. 需要修改时，在 Basic Memory 主库的项目目录编辑 `project.json` 和阶段文本；仓库中的 junction 会直接反映修改，然后按“项目文本修改后重新上传”同步。
4. 提交后 GitHub Actions 会自动校验并重新生成 `项目档.md`，公司电脑不需要安装 Node。
5. 需要继续做短剧时，把 `项目档.md` 或 `project.json` 复制给外部 AI 或 Codex。

## 多电脑同步

GitHub 仓库是同步中枢。每台电脑各自 clone 一份，不要用 OneDrive、坚果云或网盘直接同步整个 `.git` 工作区。

### 新电脑第一次连接

```powershell
git clone https://github.com/moxiaoha19251010-stack/short-drama-workbench.git
cd short-drama-workbench
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱"
```

### 每次开始修改前

```powershell
git pull --rebase
```

先拉取另一台电脑或 GitHub Actions 生成的最新内容，再编辑 `project.json`。

### 修改完成后

```powershell
git status
$project = "projects/<项目>"
git add $project "README.md" ".gitignore"
git commit -m "update: 说明本次改了什么"
git push
```

先确认 `git status` 里没有媒体、工程或缓存文件，再暂存。推送后 GitHub Actions 会自动校验并更新 `项目档.md`。

### 项目文本修改后重新上传

项目已经完成、只是改了剧本、设定、`project.json` 或成片时，按下面的顺序回传。完整命令解释见 Basic Memory《短剧全链路总览》第 4 节。

1. 在 `C:\Basic Memory short-video\game-short-video\<游戏分类>\《项目名》` 保存修改；仓库中的 junction 会自动反映文本变化。
2. 进入仓库并先拉取：

```powershell
cd C:\Users\莫小哈\Documents\Codex\short-drama-workbench
git pull --rebase
```

3. 文本项目包只包含 `project.json`、`创作蓝图.md`、`故事地图.md`、`章01_镜头剧本.md`、`设定库/`、`H3/`、`交接/`、`记录/验收记录.md`；Git 通过 `projects/<项目>` junction 读取这些文件。
4. 校验并重新生成项目档：

```powershell
$project = "projects/<项目>"
node tools/validate-project.mjs $project
node tools/render-project.mjs $project
```

5. 检查没有媒体或工程文件后提交：

```powershell
git status --short
git add $project "README.md" ".gitignore"
git commit -m "update: 同步项目文本包"
git push
```

6. 打开 GitHub Actions 确认 `Render project package` 成功；如果机器人提交了新的 `项目档.md`，本地再执行一次 `git pull --rebase`。

图片、音频、视频、Premiere/AE 工程、`记录/备份/` 不进入 Git。`Copy-Item` 不会删除仓库里已经删除的旧文件，删除或重命名文本时要单独 `git rm` 或手工删除后再提交。

### 不装 Git 的电脑

直接在 GitHub 网页编辑 `project.json` 并提交即可。网页提交也会触发自动校验和项目档生成；查看时打开 `项目档.md`，不需要安装 Node。

### 媒体文件

图片、音频、视频不进入 Git。推荐把媒体放在 OneDrive 或外置硬盘的独立目录，再让项目里的 `media/<项目名>` 指向它。Windows 可以用目录联接：

```powershell
$project = "项目名"
New-Item -ItemType Junction `
  -Path "C:\Users\莫小哈\Documents\Codex\short-drama-workbench\media\$project" `
  -Target "C:\Users\莫小哈\OneDrive\短剧媒体\$project"
```

这样 `project.json` 里的相对路径不变，换电脑只需要重新建立一次媒体目录连接。

### 冲突规则

- 两台电脑不要同时改同一个 `project.json`。
- 每次编辑前先 `git pull --rebase`。
- 出现冲突时手动合并，不要直接 `git push --force`。
- GitHub Actions 自动生成的 `项目档.md` 不要手工修改。

## 当前项目

- `projects/若娜瓦的草莓蛋糕/project.json`
- `projects/若娜瓦的草莓蛋糕/项目档.md`
- `projects/阿哈：关于我今天如何给银河系添堵/project.json`
- `projects/阿哈：关于我今天如何给银河系添堵/项目档.md`

`阿哈：关于我今天如何给银河系添堵` 的主库路径：

```text
C:\Basic Memory short-video\game-short-video\星穹铁道\《阿哈：关于我今天如何给银河系添堵》
```

## 在任意电脑查看

直接在 GitHub 网页打开 `项目档.md` 即可阅读，不需要安装 Node、Python 或本地脚本。

## 在本机校验和生成

```powershell
$project = "projects/<项目>"
node tools/validate-project.mjs $project
node tools/render-project.mjs $project
```

`render-project.mjs` 会覆盖 `项目档.md`。不要手工把 `项目档.md` 当作主数据修改。

## 编辑流程

1. 修改 `project.json`。
2. 运行校验器。
3. 运行渲染器生成 `项目档.md`。
4. 提交到 Git。

如果当前电脑没有 Node，可以在 GitHub 网页编辑 `project.json`，把生成任务交给有环境的电脑或后续浏览器工作台。

仓库已配置 GitHub Actions：在 GitHub 网页修改 `project.json` 并提交后，云端会自动校验并重新生成 `项目档.md`，不需要公司电脑安装 Node。

## 通用视频生成层

镜头剧本格式保持不变。新增的 `generation/` 是旁路层：

```text
章01_镜头剧本.md
  → generation/plan.json
  → providers/<provider>/Uxx_prompt.md
  → 人工或已有工作流生成
```

详细说明见 `docs/GENERATION.md`。现有金鱼单元音频面板和 H3 runner 不改。

## 与 Basic Memory 的关系

Basic Memory 只做归档和知识库。项目稳定后，从 `项目档.md` 导出**一份**归档笔记，不再把项目拆成十几个本地文件维护。

## 远程仓库

目标远程：

```text
https://github.com/moxiaoha19251010-stack/short-drama-workbench
```

建议使用私有仓库。远程空仓库创建后，再执行首次 `git push`。
