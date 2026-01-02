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

note "PLAN.NETWORK: ${NET_ENABLED}"
note "PLAN.DEPLOY.WORKER: ${NET_ENABLED}"
note "PLAN.DEPLOY.PAGES: ${NET_ENABLED}"
note "PLAN.VALIDATE.BROWSER: ${NET_ENABLED}"
note "PLAN.VALIDATE.API: ${NET_ENABLED}"

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

# E2) Path B routing/auth validation (browser + api).
# This command is itself network-gated and will print a stable SKIP receipt when RUN_NETWORK_TESTS!=1.
run_tee "${receipts_dir_abs}/post.deploy-validate.browser.txt" ./dev deploy:validate --surface browser || true
run_tee "${receipts_dir_abs}/post.deploy-validate.api.txt" ./dev deploy:validate --surface api || true

kv_from_file() {
  local file="$1"
  local key="$2"
  awk -F': ' -v k="$key" '$1==k {print $2; exit}' "$file" 2>/dev/null || true
}

compute_validate_ok() {
  local file="$1"
  if grep -q '^SKIP: ' "$file" 2>/dev/null; then
    printf '%s' 'skip'
    return 0
  fi

  local id_status
  local ws_upgrade
  local ws_connected
  local ws_pong
  local ws_exit

  id_status="$(kv_from_file "$file" 'ENDPOINT.V1_IDENTITY')"
  ws_upgrade="$(kv_from_file "$file" 'WS.PROBE.UPGRADE_HTTP_STATUS')"
  ws_connected="$(kv_from_file "$file" 'WS.PROOF.CONNECTED')"
  ws_pong="$(kv_from_file "$file" 'WS.PROOF.PONG_RECEIVED')"
  ws_exit="$(kv_from_file "$file" 'WS.PROOF.EXIT_CODE')"

  if [[ "$id_status" == '200' && "$ws_upgrade" == '101' && "$ws_connected" == 'yes' && "$ws_pong" == 'yes' && "$ws_exit" == '0' ]]; then
    printf '%s' 'yes'
  else
    printf '%s' 'no'
  fi
}

validate_browser_ok="$(compute_validate_ok "${receipts_dir_abs}/post.deploy-validate.browser.txt")"
validate_api_ok="$(compute_validate_ok "${receipts_dir_abs}/post.deploy-validate.api.txt")"

# E3) Canonical per-deploy proof index.
index_file="${receipts_dir_abs}/INDEX.md"
{
  printf '%s\n' '# Deploy Proof Index'
  printf 'UTC: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf 'RECEIPTS.DIR: %s\n' "$receipts_dir_rel"
  printf '\n'
  printf '%s\n' '## Key Files'
  printf '%s\n' "- SUMMARY.txt"
  printf '%s\n' "- post.deploy-validate.browser.txt"
  printf '%s\n' "- post.deploy-validate.api.txt"
  printf '\n'
  printf '%s\n' '## All Receipts'
  (cd "$receipts_dir_abs" && ls -1) | sed 's/^/- /'
} >"$index_file"

note "RECEIPTS.INDEX: ${receipts_dir_rel}/INDEX.md"

# F) Strict summary file
summary_file="${receipts_dir_abs}/SUMMARY.txt"

post_identity="$(awk -F': ' '$1=="with_service_token.V1_IDENTITY.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
post_conversations="$(awk -F': ' '$1=="with_service_token.V1_CONVERSATIONS.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
post_semantic="$(awk -F': ' '$1=="with_service_token.V1_SEMANTIC_SEARCH.http_status" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"
access_mode="$(awk -F': ' '$1=="diag.V1_IDENTITY" {print $2; exit}' "${receipts_dir_abs}/post.access-probe.txt" 2>/dev/null || true)"

{
  printf '%s\n' 'SUMMARY.VERSION: 2'
  printf 'RECEIPTS.DIR: %s\n' "$receipts_dir_rel"
  printf 'WORKER.DEPLOY.OK: %s\n' "$worker_deploy_ok"
  printf 'PAGES.DEPLOY.OK: %s\n' "$pages_deploy_ok"
  printf 'VALIDATE.BROWSER.OK: %s\n' "$validate_browser_ok"
  printf 'VALIDATE.API.OK: %s\n' "$validate_api_ok"
  printf 'POST.IDENTITY: %s\n' "${post_identity:-unknown}"
  printf 'POST.CONVERSATIONS: %s\n' "${post_conversations:-unknown}"
  printf 'POST.SEMANTIC_SEARCH: %s\n' "${post_semantic:-unknown}"
  if [[ -n "$access_mode" ]]; then
    printf 'ACCESS.MODE: %s\n' "$access_mode"
  fi
} | tee "$summary_file" >/dev/null

note 'DEPLOY.DONE: yes'
