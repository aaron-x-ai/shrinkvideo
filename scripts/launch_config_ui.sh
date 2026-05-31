#!/usr/bin/env bash
set -euo pipefail
EC_ROOT="${EASY_CONFIG_ROOT:-$HOME/.hermes/skills/easy-config}"
LAUNCH="${EC_ROOT}/scripts/launch_config_ui.sh"
if [[ ! -x "$LAUNCH" ]] && [[ ! -f "$LAUNCH" ]]; then
  echo "[FAIL] easy-config not found at $EC_ROOT" >&2
  echo "Install: git clone https://github.com/aaron-x-ai/easy-config.git $EC_ROOT" >&2
  exit 1
fi
exec bash "$LAUNCH" --skill shrinkvideo
