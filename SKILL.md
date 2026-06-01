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
  - "配置 shrinkvideo 目录"
  - "设置压缩目录"
metadata:
  hermes:
    tags: [video, productivity]
    category: productivity
---

# ShrinkVideo

## 何时使用

- 用户说：**开始视频压缩**、**开始压缩**（主场景）
- 用户已（或即将）把视频放入配置的**素材/中转目录**
- 用户要**首次确认**或修改素材目录、成品目录 → `first_setup.sh` / `shrinkvideo setup`（**不用** easy-config）

## 禁止行为

- **不要** `npm start`、**不要** Electron
- **不要** 用 `batch` 代替主场景（除非用户明确多目录 cron）
- **不要** 在未确认前重复执行 `run_inbox.sh`（避免并行压同一批文件）
- **不要** 猜测素材/成品路径；从 `doctor --json` 或 `setup --status --json` 读取
- **`setup_required: true` 时禁止 `run_inbox.sh`**（必须先完成首次目录确认）

## 首次使用（强制，无 easy-config）

设计说明见 monorepo：`dev_docs/ShrinkVideo开发实践-Skill首次运行强制配置流程.md`

1. **必须先**：`shrinkvideo doctor --json` 或 `shrinkvideo setup --status --json`
2. 若 `setup_required: true`：
   - **禁止** `run_inbox.sh`
   - 引导用户执行：

     ```bash
     bash ~/.hermes/skills/shrinkvideo/scripts/first_setup.sh
     ```

     或 `shrinkvideo setup`（会先显示**完整首次说明**，再交互确认**素材目录**、**成品目录**）
   - 若用户需要只看说明：`shrinkvideo setup --welcome`
   - 用中文向用户复述确认后的两个绝对路径，并简要概括默认画质（balanced / 1080p）与飞书口令「开始视频压缩」
   - 直至 `setup_complete: true` 且 `paths_valid: true`
3. 用户说「配置 shrinkvideo 目录」「设置压缩目录」→ 只走 `first_setup.sh`，不压缩

## 主工作流（飞书 / Hermes 口令）

用户说「**开始视频压缩**」且 `setup_required: false`：

1. **必须**先：`bash ~/.hermes/skills/shrinkvideo/scripts/doctor.sh --json`  
   - 若 `setup_required: true` → 转 **首次使用** 流程，**结束**

2. **必须**执行：

   ```bash
   bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh
   ```

3. 可先回复：「正在扫描素材目录并压缩，请稍候。」

4. 解析 stdout **json-lines**；**以最后一行** `kind":"summary"` 为准（**禁止**仅凭素材目录里「还是那几个文件名」判断已压完）：
   - `processed` / `ok` / `skipped` / `fail` / `output_dir` / `hint`

   | summary | 应对用户说 |
   |---------|------------|
   | `ok > 0` | 本次新压缩 ok 个，成品在 output_dir |
   | `skipped === processed` 且 `ok === 0` | N 个全部跳过（成品已存在），未重压 |
   | `processed === 0` | 素材目录无匹配视频 |

5. `run_inbox` 若返回 `SETUP_REQUIRED`：引导 `first_setup.sh`，**不得**谎称已压缩。

6. **长视频**：`caffeinate -i bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh`

## 次工作流：单文件

```bash
shrinkvideo compress --input "/absolute/in.mov" --output "/absolute/out.mp4" --json
```

（单文件指定 `-o` 时不强制 setup，但批处理/主场景必须完成 setup。）

## 可选：easy-config 改参数

与**首次目录确认无关**。仅当用户要图形改 codec/质量等时用：

```bash
bash ~/.hermes/skills/shrinkvideo/scripts/launch_config_ui.sh
```

## 依赖

```bash
bash ~/.hermes/skills/shrinkvideo/scripts/install.sh
hermes skills list | grep shrinkvideo
```

## 安全

- 压缩仅本地 ffmpeg，不上传。
- 默认 **不删除** 素材目录内原文件（`after_success: keep`）。
