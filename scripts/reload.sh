#!/usr/bin/env bash
# Optional hook after easy-config save (no daemon to restart).
set -euo pipefail
echo "[shrinkvideo] Config saved. Next: put videos in staging_dir, then in Feishu/Hermes say: 开始视频压缩"
echo "[shrinkvideo] Verify: shrinkvideo doctor --json && shrinkvideo run-inbox --dry-run --json-lines"
