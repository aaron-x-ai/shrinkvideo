#!/usr/bin/env bash
set -euo pipefail
# Alias for cron / launchd — same as run_inbox (主场景).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/run_inbox.sh" "$@"
