# 短剧单项目包工作区

这是跨电脑使用的短剧项目包仓库。每个项目只有两个核心文件：

- `project.json`：唯一主数据，机器和工作台读取。
- `项目档.md`：由 JSON 自动生成的中文项目档，给人阅读，不是主数据。

媒体文件不进入 Git。图片、音频、视频放在独立媒体目录，项目 JSON 只记录相对路径和媒体清单。

## 当前项目

- `projects/若娜瓦的草莓蛋糕/project.json`
- `projects/若娜瓦的草莓蛋糕/项目档.md`

## 在任意电脑查看

直接在 GitHub 网页打开 `项目档.md` 即可阅读，不需要安装 Node、Python 或本地脚本。

## 在本机校验和生成

```powershell
node tools/validate-project.mjs projects/若娜瓦的草莓蛋糕
node tools/render-project.mjs projects/若娜瓦的草莓蛋糕
```

`render-project.mjs` 会覆盖 `项目档.md`。不要手工把 `项目档.md` 当作主数据修改。

## 编辑流程

1. 修改 `project.json`。
2. 运行校验器。
3. 运行渲染器生成 `项目档.md`。
4. 提交到 Git。

如果当前电脑没有 Node，可以在 GitHub 网页编辑 `project.json`，把生成任务交给有环境的电脑或后续浏览器工作台。

仓库已配置 GitHub Actions：在 GitHub 网页修改 `project.json` 并提交后，云端会自动校验并重新生成 `项目档.md`，不需要公司电脑安装 Node。

## 与 Basic Memory 的关系

Basic Memory 只做归档和知识库。项目稳定后，从 `项目档.md` 导出**一份**归档笔记，不再把项目拆成十几个本地文件维护。

## 远程仓库

目标远程：

```text
https://github.com/moxiaoha19251010-stack/short-drama-workbench
```

建议使用私有仓库。远程空仓库创建后，再执行首次 `git push`。
