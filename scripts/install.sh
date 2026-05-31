#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[shrinkvideo] install in $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] node not found. Install Node.js 20+." >&2
  exit 1
fi

npm install
npm link 2>/dev/null || true

CONFIG_DIR="${HOME}/.config/shrinkvideo"
CONFIG_FILE="${CONFIG_DIR}/config.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
  mkdir -p "$CONFIG_DIR"
  cp "$ROOT/config/config.default.yaml" "$CONFIG_FILE"
  echo "[OK] Created $CONFIG_FILE"
else
  echo "[OK] Config exists: $CONFIG_FILE"
fi

if [[ -z "${SHRINKVIDEO_BIN_DIR:-}" ]] && [[ ! -x "$ROOT/bin/ffmpeg" ]]; then
  echo "[WARN] ffmpeg not found in $ROOT/bin"
  echo "       Development: export SHRINKVIDEO_BIN_DIR=\"\$(cd \"$ROOT/../src_shrinkmaster\" && pwd)/bin\""
  echo "       Then run: cd ../src_shrinkmaster && ./download_ffmpeg_macos.sh"
  echo "       Or copy bin/ from ShrinkMaster after download."
fi

node "$ROOT/cli/index.js" doctor || true
echo "[shrinkvideo] install done."
