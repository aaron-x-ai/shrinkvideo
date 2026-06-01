---
name: shrinkvideo
description: "ShrinkVideo — 仅本地视频压缩（不含图片）。原视频放入中转目录，飞书/Hermes 说「开始视频压缩」后一次扫描压缩，结果命名 *_shr.* 写入目标目录。无目录监听。必须 run_inbox.sh，禁止 Electron。"
version: 0.1.0
triggers:
  - "开始视频压缩"
  - "开始压缩"
  - "压缩视频"
  - "缩小视频"
  - "shrinkvideo"
  - "ShrinkVideo"
metadata:
  hermes:
    tags: [video, productivity]
    category: productivity
---

# ShrinkVideo

## 何时使用

- 用户说：**开始视频压缩**、**开始压缩**（主场景）
- 用户已（或即将）把视频放入配置的**中转目录**
- 用户要改中转目录、目标目录、压缩参数 → easy-config

## 禁止行为

- **不要** `npm start`、**不要** Electron
- **不要** 用 `batch` 代替主场景（除非用户明确多目录 cron）
- **不要** 在未确认前重复执行 `run_inbox.sh`（避免并行压同一批文件）
- **不要** 猜测中转/目标路径；从配置或 `doctor --json` 读取

## 主工作流（飞书 / Hermes 口令）

用户说「**开始视频压缩**」且视频应已在中转目录：

1. 可选：`bash ~/.hermes/skills/shrinkvideo/scripts/doctor.sh`

2. **必须**执行（稳定入口）：

   ```bash
   bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh
   ```

3. 可先回复用户：「正在扫描中转目录并压缩，请稍候。」

4. 解析 stdout **json-lines**；**以最后一行** `kind":"summary"` 为准汇报：
   - `processed` / `ok` / `fail`
   - `output_dir`（目标目录绝对路径）
   - `total_saved_ratio`（若有）

5. 若 `processed: 0`：提示用户先把视频放入 **staging_dir**（说明配置中的中转目录路径）。

6. 若有失败项：列出失败文件名与 error 摘要。

7. **长视频 / 多文件**：优先 `caffeinate -i bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh`。

8. **休眠或中断后**：再发「开始视频压缩」即可；CLI 会删除未完成 `*_shr` 并自动重压（不做断点续压）。

## 次工作流：单文件

用户给出单个绝对路径时：

```bash
shrinkvideo compress --input "/absolute/in.mov" --output "/absolute/out.mp4" --json
```

## 配置（Easy Config L2 可编辑）

Skill 根目录提供 `easy-config-schema.json`（`compatible: true`），写入 `~/.config/shrinkvideo/config.yaml`。

```bash
bash ~/.hermes/skills/shrinkvideo/scripts/launch_config_ui.sh
# 或：bash ~/.hermes/skills/easy-config/scripts/launch_config_ui.sh --skill shrinkvideo
```

需已安装 [easy-config](https://github.com/aaron-x-ai/easy-config) Skill。页眉应为绿色 **「可配置」**；保存后按 `reloadHint`：放入视频 → 飞书/Hermes 说 **「开始视频压缩」**。

校验 schema（开发）：

```bash
python -m easy_config validate-schema --file ~/.hermes/skills/shrinkvideo/easy-config-schema.json
```

## 依赖

```bash
bash ~/.hermes/skills/shrinkvideo/scripts/install.sh
hermes skills list | grep shrinkvideo
```

## 安全

- 压缩仅本地 ffmpeg，不上传。
- 默认 **不删除** 中转目录内原文件（`after_success: keep`）。
