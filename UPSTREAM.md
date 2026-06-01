# Upstream: ShrinkMaster（冻结基线）

| Field | Value |
|-------|--------|
| Repository | https://github.com/kellypeng/shrinkmaster |
| License | MIT |
| **Frozen commit** | `f699dd8` (snapshot 2026-05-31) |
| Upstream version at freeze | 0.3.0 |
| Local reference path | `../src_shrinkmaster/`（本机 monorepo，**不**纳入 GitHub `shrinkvideo` 仓） |

## 同步策略（定版：冻结，不升级）

ShrinkVideo **不跟踪** ShrinkMaster 后续版本，避免双份代码线与版本混乱。

| 规则 | 说明 |
|------|------|
| **不** `git pull` 上游 | `src_shrinkmaster/` 仅作开发期只读参考 |
| **不**在 `src_shrinkmaster/` 改产品 | 所有功能只在 `shrinkvideo/` |
| 逻辑来源 | Phase 1 从冻结版 `main.js` **一次性**迁入 `shrinkvideo/core/` |
| 致谢 | README / LICENSE 保留 ShrinkMaster MIT 说明 |

若将来**主动**重选上游基线，应新开决策记录并全量对比 `core/`，而非日常增量同步。

## `src_shrinkmaster/` 目录用途

- 对照阅读上游源码（`main.js`、`ARCHITECTURE.md` 等）
- 可选：在此执行 `download_ffmpeg_macos.sh` 生成 `bin/`（见下）
- Phase 1 完成后可删除整个目录，或去掉其 `.git` 仅留脚本；**产品不依赖**该目录长期存在

## ffmpeg 二进制（运行时，不在 Git 里）

| 项 | 说明 |
|----|------|
| 克隆后默认 | **`src_shrinkmaster/bin/` 通常不存在**（上游 `.gitignore` 忽略 `ffmpeg`/`ffprobe`） |
| 如何获得 | 在参考目录或产品目录执行 `download_ffmpeg_macos.sh`（约 260MB） |
| **实际运行** | ShrinkVideo CLI / App 只认 **`SHRINKVIDEO_BIN_DIR`** 或 **`shrinkvideo/bin/`**（开发根目录下的环境） |

推荐：将 `download_ffmpeg_macos.sh` 拷到 `shrinkvideo/scripts/`，在 **`shrinkvideo/bin/`** 下载一次，日常不再依赖 `src_shrinkmaster/`：

```bash
cd /path/to/shrinkvideo
# 复制脚本后：
./scripts/download_ffmpeg_macos.sh   # 目标：./bin/ffmpeg ./bin/ffprobe
export SHRINKVIDEO_BIN_DIR="$(pwd)/bin"
shrinkvideo doctor
```

开发期临时借用上游目录（若你曾在该处下载过）：

```bash
export SHRINKVIDEO_BIN_DIR="/path/to/aaronxai-shrinkvideo/src_shrinkmaster/bin"
```

## 文件迁移对照（一次性）

| 上游（冻结快照） | ShrinkVideo |
|------------------|-------------|
| `main.js` 压缩/编码器逻辑 | `core/video.js`、`core/encoders.js`、`core/paths.js` |
| `main.js` 图片逻辑 | **不迁移**（产品仅视频） |
| `renderer.js` / `index.html` | Phase 4 → `app/`（可选） |
| `download_ffmpeg_macos.sh` | `shrinkvideo/scripts/`（建议复制） |
