#!/usr/bin/env bash
set -euo pipefail
# Stable entry for cron / launchd (Phase 2+).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if command -v shrinkvideo >/dev/null 2>&1; then
  exec shrinkvideo batch --json-lines "$@"
fi
exec node "$ROOT/cli/index.js" batch --json-lines "$@"
