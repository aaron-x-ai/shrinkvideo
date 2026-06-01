#!/usr/bin/env bash
# Open Easy Config L2 editor for ~/.config/shrinkvideo/config.yaml
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EC_ROOT="${EASY_CONFIG_ROOT:-$HOME/.hermes/skills/easy-config}"
LAUNCH="${EC_ROOT}/scripts/launch_config_ui.sh"
if [[ ! -f "$LAUNCH" ]]; then
  echo "[FAIL] easy-config not found at $EC_ROOT" >&2
  echo "Install: git clone https://github.com/aaron-x-ai/easy-config.git $EC_ROOT" >&2
  exit 1
fi
if [[ ! -f "$ROOT/easy-config-schema.json" ]]; then
  echo "[FAIL] missing $ROOT/easy-config-schema.json (L2 compatible schema)" >&2
  exit 1
fi
exec bash "$LAUNCH" --skill shrinkvideo "$@"
