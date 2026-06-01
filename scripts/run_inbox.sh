#!/usr/bin/env bash
set -euo pipefail
# Primary entry for Feishu / Hermes: "开始视频压缩"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if command -v shrinkvideo >/dev/null 2>&1; then
  exec shrinkvideo run-inbox --json-lines --continue-on-error "$@"
fi
exec node "$ROOT/cli/index.js" run-inbox --json-lines --continue-on-error "$@"
