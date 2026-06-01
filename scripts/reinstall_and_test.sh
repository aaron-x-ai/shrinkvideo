#!/usr/bin/env bash
# 清理 Hermes 已安装副本 → 安装 Skill → doctor → run-inbox 测试（无 Web 控制台）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_REPO_ROOT="$ROOT"
HERMES_SKILL_DIR="${SHRINKVIDEO_INSTALL_DIR:-$HOME/.hermes/skills/shrinkvideo}"
CONFIG_DIR="${SHRINKVIDEO_CONFIG_DIR:-$HOME/.config/shrinkvideo}"
SHRINKVIDEO_GIT_URL="${SHRINKVIDEO_GIT_URL:-https://github.com/aaron-x-ai/shrinkvideo.git}"
SHRINKVIDEO_GIT_BRANCH="${SHRINKVIDEO_GIT_BRANCH:-main}"
DEFAULT_TESTCASE="${SHRINKVIDEO_TESTCASE:-$DEV_REPO_ROOT/../testcases/ShrinkVideo_Testcase1.MOV}"

KEEP_DATA=-1
SKILL_SOURCE=-1
SMOKE=0
DRY_RUN_ONLY=1

usage() {
  cat <<'EOF'
Usage: bash scripts/reinstall_and_test.sh [options]

将 ShrinkVideo 安装到 ~/.hermes/skills/shrinkvideo 并做 Hermes 侧自检。

交互（两道独立题，可组合）：
  1) 保留数据 或 2) 删除 ~/.config/shrinkvideo（含 inbox-state）
  2-1) 本机复制 或 2-2) GitHub clone

步骤：
  1. 结束可能正在运行的 shrinkvideo/ffmpeg 批处理（尽力而为）
  2. 删除 ~/.hermes/skills/shrinkvideo
  3. 按 2-1/2-2 安装 Skill 代码
  4. install.sh + doctor.sh（--json）
  5. run-inbox --dry-run --json-lines
  6. 可选 --smoke：用金样 MOV 做一次真实压缩验收

Options:
  --keep-data       保留用户配置（跳过第 1 题）
  --clean           删除用户配置（跳过第 1 题）
  --from-local      2-1 本机复制（默认）
  --from-github     2-2 GitHub clone
  --clean-github    等同 --clean --from-github
  --smoke           安装后跑真实 run-inbox（需本机金样或 SHRINKVIDEO_TESTCASE）
  --no-dry-run      跳过 dry-run，仅 doctor（加 --smoke 时仍会压测）
  -h, --help        显示本帮助

环境变量:
  SHRINKVIDEO_INSTALL_DIR   默认 ~/.hermes/skills/shrinkvideo
  SHRINKVIDEO_CONFIG_DIR    默认 ~/.config/shrinkvideo
  SHRINKVIDEO_GIT_URL       2-2 时 clone 地址
  SHRINKVIDEO_GIT_BRANCH    2-2 时分支（默认 main）
  SHRINKVIDEO_TESTCASE      --smoke 时输入 MOV 路径
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-data) KEEP_DATA=1 ;;
    --clean) KEEP_DATA=0 ;;
    --from-local) SKILL_SOURCE=local ;;
    --from-github) SKILL_SOURCE=github ;;
    --clean-github) KEEP_DATA=0; SKILL_SOURCE=github ;;
    --smoke) SMOKE=1 ;;
    --no-dry-run) DRY_RUN_ONLY=0 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[reinstall] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

reinstall_msg() {
  echo "[reinstall] $*"
}

choose_data_mode() {
  if [[ "$KEEP_DATA" -ge 0 ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    reinstall_msg "非交互终端，默认保留用户数据（删配置加 --clean）"
    KEEP_DATA=1
    return
  fi

  echo ""
  echo "【第 1 题】用户数据（${CONFIG_DIR}）"
  echo "  1) 保留 — 保留 config.yaml、inbox-state.json（日常更新推荐）"
  echo "  2) 全新 — 删除上述目录，重复测试用"
  echo ""

  while true; do
    local choice=""
    read -r -p "请输入 1 或 2 [默认 1]: " choice
    choice="${choice:-1}"
    case "$choice" in
      1|保留*|keep*)
        KEEP_DATA=1
        reinstall_msg "已选择: 保留数据"
        break
        ;;
      2|全新*|clean*)
        KEEP_DATA=0
        reinstall_msg "已选择: 全新安装"
        break
        ;;
      *)
        echo "无效输入，请输入 1 或 2。"
        ;;
    esac
  done
  echo ""
}

choose_skill_source() {
  if [[ "$SKILL_SOURCE" != "-1" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    reinstall_msg "非交互终端，Skill 代码默认本机复制（GitHub 加 --from-github）"
    SKILL_SOURCE=local
    return
  fi

  echo ""
  echo "【第 2 题】Skill 代码来源"
  echo "  2-1) 本机复制 — ${ROOT}"
  echo "  2-2) GitHub — ${SHRINKVIDEO_GIT_URL} (${SHRINKVIDEO_GIT_BRANCH})"
  echo ""

  while true; do
    local sub=""
    read -r -p "请输入 2-1 或 2-2 [默认 2-1]: " sub
    sub="${sub:-2-1}"
    case "$sub" in
      2-1|2.1|本机*|local*)
        SKILL_SOURCE=local
        reinstall_msg "已选择: 2-1 本机复制"
        break
        ;;
      2-2|2.2|github*|git*)
        SKILL_SOURCE=github
        reinstall_msg "已选择: 2-2 GitHub clone"
        break
        ;;
      *)
        echo "无效输入，请输入 2-1 或 2-2。"
        ;;
    esac
  done
  echo ""
}

stop_running_jobs() {
  if pkill -f "[s]hrinkvideo run-inbox" 2>/dev/null; then
    reinstall_msg "已发送结束信号: shrinkvideo run-inbox"
    sleep 0.5
  fi
}

remove_install() {
  reinstall_msg "删除已安装 Skill: $HERMES_SKILL_DIR"
  rm -rf "$HERMES_SKILL_DIR"

  if [[ "$KEEP_DATA" -eq 0 ]]; then
    reinstall_msg "删除用户配置: $CONFIG_DIR"
    rm -rf "$CONFIG_DIR"
  else
    reinstall_msg "保留用户数据"
  fi
}

clone_skill_from_github() {
  if ! command -v git >/dev/null 2>&1; then
    echo "[reinstall] 需要 git 才能从 GitHub 安装" >&2
    exit 1
  fi
  reinstall_msg "GitHub clone → $HERMES_SKILL_DIR"
  mkdir -p "$(dirname "$HERMES_SKILL_DIR")"
  git clone --branch "$SHRINKVIDEO_GIT_BRANCH" --depth 1 "$SHRINKVIDEO_GIT_URL" "$HERMES_SKILL_DIR"
}

copy_skill_tree() {
  reinstall_msg "本机复制: ${ROOT} → $HERMES_SKILL_DIR"
  mkdir -p "$(dirname "$HERMES_SKILL_DIR")"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude '.cursor/' \
      --exclude '.DS_Store' \
      "$ROOT/" "$HERMES_SKILL_DIR/"
  else
    rm -rf "$HERMES_SKILL_DIR"
    mkdir -p "$HERMES_SKILL_DIR"
    tar -C "$ROOT" \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.cursor' \
      -cf - . | tar -C "$HERMES_SKILL_DIR" -xf -
  fi
}

install_skill_code() {
  choose_skill_source
  if [[ "$SKILL_SOURCE" == "github" ]]; then
    clone_skill_from_github
  else
    copy_skill_tree
  fi
}

run_install() {
  reinstall_msg "执行 install.sh"
  (cd "$HERMES_SKILL_DIR" && bash scripts/install.sh)

  reinstall_msg "执行 doctor.sh --json"
  (cd "$HERMES_SKILL_DIR" && bash scripts/doctor.sh --json) | tee /tmp/shrinkvideo-reinstall-doctor.json
  echo ""

  if ! grep -q '"status":"ok"' /tmp/shrinkvideo-reinstall-doctor.json 2>/dev/null; then
    echo "[reinstall] doctor 未通过（status 非 ok）" >&2
    exit 1
  fi
  reinstall_msg "doctor 通过"
}

run_dry_run() {
  reinstall_msg "Hermes 入口自检: run_inbox.sh --dry-run"
  (cd "$HERMES_SKILL_DIR" && bash scripts/run_inbox.sh --dry-run --json-lines) || {
    echo "[reinstall] dry-run 失败" >&2
    exit 1
  }
  reinstall_msg "dry-run 完成"
}

read_config_paths() {
  local py='
import os, sys
try:
    import yaml
except ImportError:
    sys.exit(2)
path = os.path.expanduser("~/.config/shrinkvideo/config.yaml")
if not os.path.isfile(path):
    sys.exit(1)
with open(path) as f:
    c = yaml.safe_load(f) or {}
inbox = c.get("inbox") or {}
print(inbox.get("staging_dir", ""))
print(inbox.get("output_dir", ""))
'
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import yaml' 2>/dev/null; then
    mapfile -t _paths < <(python3 -c "$py")
    STAGING_DIR="${_paths[0]:-}"
    OUTPUT_DIR="${_paths[1]:-}"
    return 0
  fi
  STAGING_DIR="/Users/mac/Downloads/shrinkvideo_work"
  OUTPUT_DIR="/Users/mac/Downloads/shrinkvideo_work/done"
  reinstall_msg "未安装 PyYAML，冒烟测试使用默认 Downloads 路径"
}

run_smoke_test() {
  local testcase="$DEFAULT_TESTCASE"
  if [[ ! -f "$testcase" ]]; then
    reinstall_msg "跳过 --smoke：金样不存在: $testcase"
    reinstall_msg "  可设置 SHRINKVIDEO_TESTCASE 或从本机 monorepo 复制 testcases/"
    return 0
  fi

  read_config_paths
  if [[ -z "$STAGING_DIR" || -z "$OUTPUT_DIR" ]]; then
    echo "[reinstall] 无法读取 inbox 目录，跳过 smoke" >&2
    return 1
  fi

  mkdir -p "$STAGING_DIR" "$OUTPUT_DIR"
  local base
  base="$(basename "$testcase")"
  reinstall_msg "冒烟: 复制 $testcase → $STAGING_DIR/"
  cp -f "$testcase" "$STAGING_DIR/$base"
  rm -f "$OUTPUT_DIR/${base%.*}_shr.${base##*.}"

  reinstall_msg "冒烟: run_inbox.sh（真实压缩，可能需数分钟）"
  local out
  out="$(cd "$HERMES_SKILL_DIR" && bash scripts/run_inbox.sh --json-lines 2>&1)"
  echo "$out" | tail -5

  if echo "$out" | grep -q '"kind":"summary".*"ok":1'; then
    reinstall_msg "冒烟通过: summary ok>=1"
  elif echo "$out" | grep -q '"status":"ok"'; then
    reinstall_msg "冒烟: 有成功记录（请检查 summary 行）"
  else
    echo "[reinstall] 冒烟未看到成功 summary" >&2
    exit 1
  fi
}

print_hermes_hints() {
  echo ""
  reinstall_msg "Hermes 安装路径: $HERMES_SKILL_DIR"
  reinstall_msg "验证: hermes skills list | grep shrinkvideo"
  reinstall_msg "飞书试跑: bash $HERMES_SKILL_DIR/scripts/run_inbox.sh"
  reinstall_msg "长任务: caffeinate -i bash $HERMES_SKILL_DIR/scripts/run_inbox.sh"
  echo ""
}

main() {
  reinstall_msg "开发仓库: $ROOT"
  choose_data_mode
  stop_running_jobs
  remove_install
  install_skill_code
  run_install

  if [[ "$DRY_RUN_ONLY" -eq 1 ]]; then
    run_dry_run
  fi

  if [[ "$SMOKE" -eq 1 ]]; then
    run_smoke_test
  fi

  print_hermes_hints
  reinstall_msg "完成"
}

main "$@"
