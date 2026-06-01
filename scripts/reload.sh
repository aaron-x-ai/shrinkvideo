#!/usr/bin/env bash
# Optional hook after config change (no daemon to restart).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[shrinkvideo] Config updated."
if command -v shrinkvideo >/dev/null 2>&1; then
  shrinkvideo setup --status || true
else
  node "$ROOT/cli/index.js" setup --status || true
fi
echo "[shrinkvideo] If setup_required, run: bash $ROOT/scripts/first_setup.sh"
echo "[shrinkvideo] Else: put videos in staging_dir, then say: 开始视频压缩"
