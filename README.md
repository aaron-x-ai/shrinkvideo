# ShrinkVideo

Local video and image compression for macOS — **CLI for Hermes agents and automation**, plus a native GUI (planned) based on [ShrinkMaster](https://github.com/kellypeng/shrinkmaster).

- **Repository**: https://github.com/aaron-x-ai/shrinkvideo  
- **Design docs** (local monorepo): `../dev_docs/产品开发文档_002.md`

## Main workflow (Feishu / Hermes)

1. Configure **staging** and **output** directories (easy-config or `~/.config/shrinkvideo/config.yaml`).
2. Drop original videos into the **staging** folder.
3. Say **「开始视频压缩」** in Feishu or Hermes → Agent runs `scripts/run_inbox.sh`.
4. Compressed files appear in the **output** folder as `*_shr.*` (e.g. `clip_shr.mp4`). Video only; no images. No folder watcher — trigger by message or cron only.

## CLI (P0–P2)

```bash
cd shrinkvideo
bash scripts/download_ffmpeg_macos.sh   # or ensure bin/ffmpeg exists
npm install && npm link
shrinkvideo doctor --json
shrinkvideo run-inbox --json-lines      # uses ~/.config/shrinkvideo/config.yaml
shrinkvideo history                     # ~/.config/shrinkvideo/compress-history.log
```

压缩记录（每次 ok / skipped / failed 追加）：

- `~/.config/shrinkvideo/compress-history.jsonl` — 机器可读
- `~/.config/shrinkvideo/compress-history.log` — 人类可读一行一条
- `~/.config/shrinkvideo/inbox-state.json` — 每个源文件状态 + **体积/mtime 指纹**（同名新拷贝会识别并重压）
```

## Hermes 重装 + 自检（开发维护，monorepo 根）

脚本在 **`../dev_scripts/`**（与 `dev_docs/` 同级，不进 GitHub 产品仓）：

```bash
cd ..   # aaronxai-shrinkvideo monorepo 根
bash dev_scripts/reinstall_and_test.sh              # 交互：保留数据 / 本机|GitHub
bash dev_scripts/reinstall_and_test.sh --from-local --keep-data
bash dev_scripts/reinstall_and_test.sh --clean --from-local --smoke   # 含金样压缩冒烟
```

See `../dev_docs/产品开发文档_002.md` §4.4.

## Easy Config (L2 可编辑)

`easy-config-schema.json` 声明 `compatible: true`，写入 `~/.config/shrinkvideo/config.yaml`。

```bash
bash scripts/launch_config_ui.sh
python -m easy_config validate-schema --file ./easy-config-schema.json
```

页眉应为绿色 **「可配置」**；stdout JSON 含 `"capability": "edit"`。

## Status

| Phase | State |
|-------|--------|
| P0 — scaffold | Done |
| P1 — `core/` | Done |
| P2 — `run-inbox` | Done |
| P3 — easy-config L2 | Done |
| P4 — Electron GUI | Planned |

## Requirements

- macOS 11+ (primary)
- Node.js 20+
- ffmpeg/ffprobe (bundled via `scripts/install.sh` or `SHRINKVIDEO_BIN_DIR`)

## Install (development)

```bash
cd /path/to/shrinkvideo
npm install
npm link

# Reuse upstream ffmpeg (recommended during development):
export SHRINKVIDEO_BIN_DIR="$(cd ../src_shrinkmaster && pwd)/bin"
# If empty: cd ../src_shrinkmaster && ./download_ffmpeg_macos.sh

shrinkvideo doctor
```

## Hermes Skill

```bash
git clone https://github.com/aaron-x-ai/shrinkvideo.git ~/.hermes/skills/shrinkvideo
cd ~/.hermes/skills/shrinkvideo
bash scripts/install.sh
hermes skills list | grep shrinkvideo
```

配置 UI：`bash scripts/launch_config_ui.sh`（见上文 Easy Config）。

## Acknowledgments

ShrinkVideo is derived from **ShrinkMaster** by Kelly Peng (MIT). See [UPSTREAM.md](./UPSTREAM.md).

## License

MIT — see [LICENSE](./LICENSE).
