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
```

See `../dev_docs/产品开发文档_002.md` §4.4.

## Status

| Phase | State |
|-------|--------|
| P0 — scaffold | Done |
| P1 — `core/` extraction | Planned |
| P2 — CLI MVP + `run-inbox` | Planned |
| P3 — easy-config (inbox paths) | Planned |
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

Configure via [easy-config](https://github.com/aaron-x-ai/easy-config) when available (Phase 3).

## Acknowledgments

ShrinkVideo is derived from **ShrinkMaster** by Kelly Peng (MIT). See [UPSTREAM.md](./UPSTREAM.md).

## License

MIT — see [LICENSE](./LICENSE).
