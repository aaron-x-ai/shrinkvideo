# ShrinkVideo

Local video and image compression for macOS — **CLI for Hermes agents and automation**, plus a native GUI (planned) based on [ShrinkMaster](https://github.com/kellypeng/shrinkmaster).

- **Repository**: https://github.com/aaron-x-ai/shrinkvideo  
- **Design docs** (local monorepo): `../dev_docs/产品开发文档_002.md`

## Status

| Phase | State |
|-------|--------|
| P0 — scaffold | Done |
| P1 — `core/` extraction | Planned |
| P2 — CLI MVP | Planned |
| P3 — easy-config + batch | Planned |
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
