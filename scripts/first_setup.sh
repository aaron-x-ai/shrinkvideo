#!/usr/bin/env bash
# First-run: full welcome + confirm staging_dir (素材) and output_dir (成品).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARGS=()
for a in "$@"; do
  case "$a" in
    --no-briefing|--quiet|-q) ARGS+=("$a") ;;
    --welcome) ARGS+=("$a") ;;
    *) ARGS+=("$a") ;;
  esac
done
if command -v shrinkvideo >/dev/null 2>&1; then
  exec shrinkvideo setup "${ARGS[@]}"
fi
exec node "$ROOT/cli/index.js" setup "${ARGS[@]}"
