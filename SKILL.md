---
name: shrinkvideo
description: "ShrinkVideo — 本地视频/图片压缩。用户要压缩视频、批量缩小文件、定时压缩目录时使用。必须调用 shrinkvideo CLI，禁止启动 Electron GUI。"
version: 0.1.0
triggers:
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

- 用户要：**压缩视频/图片**、**批量缩小**、**定时处理某文件夹**
- 用户提到：**ShrinkVideo**、**shrinkvideo**

## 禁止行为

- **不要** `npm start`、**不要**启动 Electron（无图形会话 / cron 不可用）
- **不要** 使用相对路径；输入输出用**绝对路径**
- **不要** 在未执行 `doctor` 前对超大文件重复并行压缩

## 工作流（Agent 必须遵守）

1. 确认 Skill 已安装：

   ```bash
   hermes skills list | grep shrinkvideo
   ```

2. 环境检查：

   ```bash
   bash ~/.hermes/skills/shrinkvideo/scripts/doctor.sh
   ```

   或 `shrinkvideo doctor --json`，解析首行 JSON。

3. **单次压缩**（Phase 2+）：

   ```bash
   shrinkvideo compress --input "/absolute/in.mov" --output "/absolute/out.mp4" --json
   ```

4. **批处理**（Phase 2+，读 `~/.config/shrinkvideo/config.yaml`）：

   ```bash
   shrinkvideo batch --json-lines
   ```

5. **改配置**（Phase 3+，需已安装 easy-config）：

   ```bash
   bash ~/.hermes/skills/shrinkvideo/scripts/launch_config_ui.sh
   ```

   从 stdout JSON 取 `url`（含 token）；macOS 通常由 easy-config 本机打开浏览器。

6. 向用户报告：`saved_ratio`、`output` 路径；失败时贴 stderr 摘要。

## 依赖

```bash
bash ~/.hermes/skills/shrinkvideo/scripts/install.sh
```

- Node.js 20+
- ffmpeg（`SHRINKVIDEO_BIN_DIR` 或 Skill 内 `bin/`）

## 安全

- 压缩过程**不上传**文件；仅本地 ffmpeg。
- 不覆盖源文件；输出路径由用户或 config 指定。
