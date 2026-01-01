#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# deploy:prod
#
# Receipt-first deterministic deploy orchestrator.
# Writes receipts under receipts/deploy/<YYYY-MM-DD>/<HHMMSS>/
# and updates receipts/deploy/latest.txt.
#
# Hard rules:
# - Never print secrets.
# - Do not require a TTY (no prompts).
# - Network calls remain opt-in via RUN_NETWORK_TESTS=1.

# Avoid recursion when running under Bats (verify:devshell runs bats).
IN_BATS='no'
if [[ -n "${BATS_TEST_FILENAME:-}" || -n "${BATS_TEST_DIRNAME:-}" ]]; then
  IN_BATS='yes'
fi

note() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

run_tee() {
  local out_file="$1"
  shift

  mkdir -p "$(dirname -- "$out_file")"

  # Capture both stdout+stderr to the receipt file, while preserving exit status.
  set +e
  ("$@" 2>&1) | tee "$out_file"
  local cmd_status=${PIPESTATUS[0]}
  set -e
  return "$cmd_status"
}

write_skip_receipt() {
  local out_file="$1"
  local msg="$2"
  mkdir -p "$(dirname -- "$out_file")"
  printf '%s\n' "$msg" | tee "$out_file" >/dev/null
}

# A) Preflight (no network enforced here; subcommands keep their own safety rails).
# If any fail: stop.
{
  git_status="$(git status --porcelain=v1 2>/dev/null || true)"
  note 'PREFLIGHT.GIT.STATUS.PORCELAIN: begin'
  if [[ -n "$git_status" ]]; then
    printf '%s\n' "$git_status"
  fi
  note 'PREFLIGHT.GIT.STATUS.PORCELAIN: end'

  ./dev secrets:status
  ./devshell/devshell doctor

  if [[ "$IN_BATS" == 'yes' ]]; then
    note 'PREFLIGHT.SKIP.VERIFY_DEVSHELL: yes'
    note 'PREFLIGHT.SKIP.TEST_NODE: yes'
  else
    pnpm -s run verify:devshell
    pnpm -s test:node
  fi
} || {
  printf '%s\n' 'DEPLOY.ABORTED: yes'
  printf '%s\n' 'DEPLOY.ABORT_REASON: preflight_failed'
  exit 1
}

# B) Receipts dir (single timestamp)
day="$(date -u +%Y-%m-%d)"
time="$(date -u +%H%M%S)"
receipts_dir_rel="receipts/deploy/${day}/${time}"
receipts_dir_abs="${repo_root}/${receipts_dir_rel}"

mkdir -p "$receipts_dir_abs"

printf '%s\n' "$receipts_dir_abs" >"${repo_root}/receipts/deploy/latest.txt"
printf 'RECEIPTS.DIR: %s\n' "$receipts_dir_rel"

# Helpers to choose whether to run networked commands.
NET_ENABLED='no'
if [[ "${RUN_NETWORK_TESTS:-0}" == "1" ]]; then
  NET_ENABLED='yes'
fi

# C) Pre-deploy evidence
if [[ "$NET_ENABLED" == 'yes' ]]; then
  run_tee "${receipts_dir_abs}/pre.worker-secrets-list.txt" ./dev cf:worker:secrets:list || true
  run_tee "${receipts_dir_abs}/pre.cf-worker-smoke.txt" ./dev cf:worker:smoke || true
  run_tee "${receipts_dir_abs}/pre.access-probe.txt" ./dev access:probe || true
  run_tee "${receipts_dir_abs}/pre.cf-access-audit.txt" ./dev cf:access:audit || true
else
  run_tee "${receipts_dir_abs}/pre.worker-secrets-list.txt" ./dev cf:worker:secrets:list || true
  run_tee "${receipts_dir_abs}/pre.cf-worker-smoke.txt" ./dev cf:worker:smoke || true
  run_tee "${receipts_dir_abs}/pre.access-probe.txt" ./dev access:probe || true
  write_skip_receipt "${receipts_dir_abs}/pre.cf-access-audit.txt" 'SKIP: Set RUN_NETWORK_TESTS=1 to enable Cloudflare Access audit.'
fi

# D) Deploy
worker_deploy_ok='no'
pages_deploy_ok='no'

if [[ "$NET_ENABLED" == 'yes' ]]; then
  run_tee "${receipts_dir_abs}/deploy.worker.txt" ./dev cf:worker:deploy || true
  if grep -q '^WORKER\.DEPLOY\.OK: yes' "${receipts_dir_abs}/deploy.worker.txt"; then
    worker_deploy_ok='yes'
  fi

  run_tee "${receipts_dir_abs}/deploy.pages.txt" ./dev cf:pages:deploy || true
  if grep -q '^PAGES\.DEPLOY\.OK: yes' "${receipts_dir_abs}/deploy.pages.txt"; then
    pages_deploy_ok='yes'
  fi
else
  # Still create deploy receipts, but do not attempt any Cloudflare calls.
  run_tee "${receipts_dir_abs}/deploy.worker.txt" ./dev cf:worker:deploy || true
  run_tee "${receipts_dir_abs}/deploy.pages.txt" ./dev cf:pages:deploy || true
  warn 'Network not enabled; deploy steps were skipped. Set RUN_NETWORK_TESTS=1 to deploy.'
fi

# E) Post-deploy validation
if [[ "$NET_ENABLED" == 'yes' ]]; then
  run_tee "${receipts_dir_abs}/post.cf-worker-audit.txt" ./dev cf:worker:audit || true
  run_tee "${receipts_dir_abs}/post.cf-worker-smoke.txt" ./dev cf:worker:smoke || true
  run_tee "${receipts_dir_abs}/post.access-probe.txt" ./dev access:probe || true
  run_tee "${receipts_dir_abs}/post.cf-access-audit.txt" ./dev cf:access:audit || true
  run_tee "${receipts_dir_abs}/post.worker-secrets-list.txt" ./dev cf:worker:secrets:list || true
else
  run_tee "${receipts_dir_abs}/post.cf-worker-audit.txt" ./dev cf:worker:audit || true
  run_tee "${receipts_dir_abs}/post.cf-worker-smoke.txt" ./dev cf:worker:smoke || true
  run_tee "${receipts_dir_abs}/post.access-probe.txt" ./dev access:probe || true
  write_skip_receipt "${receipts_dir_abs}/post.cf-access-audit.txt" 'SKIP: Set RUN_NETWORK_TESTS=1 to enable Cloudflare Access audit.'
  run_tee "${receipts_dir_abs}/post.worker-secrets-list.txt" ./dev cf:worker:secrets:list || true
fi

# F) Strict summary file
summary_file="${receipts_dir_abs}/SUMMARY.txt"

post_identity="$(awk -F': ' '$1=="with_service_token.V1_IDENTITY.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
post_conversations="$(awk -F': ' '$1=="with_service_token.V1_CONVERSATIONS.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
post_semantic="$(awk -F': ' '$1=="with_service_token.V1_SEMANTIC_SEARCH.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
access_mode="$(awk -F': ' '$1=="diag.V1_IDENTITY" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"

{
  printf '%s\n' 'SUMMARY.VERSION: 1'
  printf 'RECEIPTS.DIR: %s\n' "$receipts_dir_rel"
  printf 'WORKER.DEPLOY.OK: %s\n' "$worker_deploy_ok"
  printf 'PAGES.DEPLOY.OK: %s\n' "$pages_deploy_ok"
  printf 'POST.IDENTITY: %s\n' "${post_identity:-unknown}"
  printf 'POST.CONVERSATIONS: %s\n' "${post_conversations:-unknown}"
  printf 'POST.SEMANTIC_SEARCH: %s\n' "${post_semantic:-unknown}"
  if [[ -n "$access_mode" ]]; then
    printf 'ACCESS.MODE: %s\n' "$access_mode"
  fi
} | tee "$summary_file" >/dev/null

note 'DEPLOY.DONE: yes'
