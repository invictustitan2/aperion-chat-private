#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# deploy:validate
#
# Quick network-gated validator for prod API routing/auth.
# Prints only a small stable schema (no raw logs).
#
# Hard rules:
# - Never print secrets.
# - Network must be opt-in (RUN_NETWORK_TESTS=1).

# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

surface="api"
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --surface)
      surface="${2:-}"
      shift 2
      ;;
    *)
      printf '%s\n' 'VALIDATE.VERSION: 2'
      printf 'ERROR: unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [[ "$surface" != 'api' && "$surface" != 'browser' ]]; then
  printf '%s\n' 'VALIDATE.VERSION: 2'
  printf 'ERROR: invalid --surface (expected api|browser): %s\n' "$surface" >&2
  exit 2
fi

ws_probe_url=''
ws_proof_mode='headless'

ws_url=''
if [[ "$surface" == 'api' ]]; then
  ws_url='wss://api.aperion.cc/v1/ws'
  ws_probe_url='https://api.aperion.cc/v1/ws'
else
  ws_url='wss://chat.aperion.cc/api/v1/ws'
  ws_probe_url='https://chat.aperion.cc/api/v1/ws'
fi

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'VALIDATE.VERSION: 2'
  printf 'SURFACE: %s\n' "$surface"
  printf 'STEP.1: %s\n' 'cf:worker:smoke'
  printf 'STEP.2: %s\n' 'access:probe'
  printf 'STEP.3: %s\n' 'ws:probe'
  printf 'STEP.4: %s\n' 'ws:proof --mode headless'
  printf 'WS.PROBE.URL: %s\n' "$ws_probe_url"
  printf 'WS.PROOF.URL: %s\n' "$ws_url"
  printf 'WS.PROOF.MODE: %s\n' "$ws_proof_mode"
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network validation.'
  exit 0
fi

worker_smoke_out="$(./dev cf:worker:smoke --surface "$surface" 2>&1 || true)"
access_probe_out="$(./dev access:probe --surface "$surface" 2>&1 || true)"

ws_probe_out="$(./dev ws:probe --surface "$surface" 2>&1 || true)"

# Load + validate service token values from env or secrets file so WS smoke can
# send headers via env (never printed).
aperion_secrets_load
aperion_secrets_validate >/dev/null

# Ensure Node sees these for scripts/smoke-ws.mjs.
# (aperion_secrets_load may set shell vars but not export them.)
export CF_ACCESS_SERVICE_TOKEN_ID
export CF_ACCESS_SERVICE_TOKEN_SECRET

ws_proof_out=''
ws_proof_exit_code=0
set +e
ws_proof_out="$(./dev ws:proof --surface "$surface" --mode headless 2>&1)"
ws_proof_exit_code=$?
set -e

get_kv_value() {
  local key="$1"
  local text="$2"
  printf '%s\n' "$text" | awk -v k="$key" -F': ' '$1==k {print $2; exit}'
}

identity="$(get_kv_value 'with_service_token.V1_IDENTITY.http_status' "$access_probe_out")"
conversations="$(get_kv_value 'with_service_token.V1_CONVERSATIONS.http_status' "$access_probe_out")"
semantic="$(get_kv_value 'with_service_token.V1_SEMANTIC_SEARCH.http_status' "$access_probe_out")"

diag="$(get_kv_value 'diag.V1_IDENTITY' "$access_probe_out")"

ws_probe_upgrade_status="$(get_kv_value 'with_service_token.upgrade.http_status' "$ws_probe_out")"
ws_probe_upgrade_accept="$(get_kv_value 'with_service_token.upgrade.sec-websocket-accept' "$ws_probe_out")"

ws_proof_connected="$(printf '%s\n' "$ws_proof_out" | sed -n 's/^CONNECTED: \(yes\|no\)$/\1/p' | tail -n 1)"

ws_proof_receipt_latest_path="receipts/ws-proof.${surface}.latest.json"
ws_proof_pong_received=''
ws_proof_handshake_http_status=''
if [[ -f "$ws_proof_receipt_latest_path" ]]; then
  ws_proof_pong_received="$(
    node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.pong_received?'yes':'no')" "$ws_proof_receipt_latest_path" 2>/dev/null || true
  )"
  ws_proof_handshake_http_status="$(
    node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String((j.handshake&&j.handshake.http_status)||''))" "$ws_proof_receipt_latest_path" 2>/dev/null || true
  )"
fi

# Fallback to worker smoke if access:probe output format changes.
if [[ -z "$identity" ]]; then
  identity="$(get_kv_value 'with_service_token.V1_IDENTITY.http_status' "$worker_smoke_out")"
fi
if [[ -z "$conversations" ]]; then
  conversations="$(get_kv_value 'with_service_token.V1_CONVERSATIONS.http_status' "$worker_smoke_out")"
fi
if [[ -z "$semantic" ]]; then
  semantic="$(get_kv_value 'with_service_token.V1_SEMANTIC_SEARCH.http_status' "$worker_smoke_out")"
fi

printf '%s\n' 'VALIDATE.VERSION: 2'
printf 'SURFACE: %s\n' "$surface"
printf 'STEP.1: %s\n' 'cf:worker:smoke'
printf 'STEP.2: %s\n' 'access:probe'
printf 'STEP.3: %s\n' 'ws:probe'
printf 'STEP.4: %s\n' 'ws:proof --mode headless'
printf 'ENDPOINT.V1_IDENTITY: %s\n' "${identity:-unknown}"
printf 'ENDPOINT.V1_CONVERSATIONS: %s\n' "${conversations:-unknown}"
printf 'ENDPOINT.V1_SEMANTIC_SEARCH: %s\n' "${semantic:-unknown}"
printf 'WS.PROBE.URL: %s\n' "$ws_probe_url"
printf 'WS.PROBE.UPGRADE_HTTP_STATUS: %s\n' "${ws_probe_upgrade_status:-unknown}"
printf 'WS.PROBE.SEC_WEBSOCKET_ACCEPT: %s\n' "${ws_probe_upgrade_accept:-}"
printf 'WS.PROOF.URL: %s\n' "$ws_url"
printf 'WS.PROOF.MODE: %s\n' "$ws_proof_mode"
printf 'WS.PROOF.CONNECTED: %s\n' "${ws_proof_connected:-unknown}"
printf 'WS.PROOF.PONG_RECEIVED: %s\n' "${ws_proof_pong_received:-unknown}"
printf 'WS.PROOF.HANDSHAKE_HTTP_STATUS: %s\n' "${ws_proof_handshake_http_status:-}"
printf 'WS.PROOF.EXIT_CODE: %s\n' "$ws_proof_exit_code"
if [[ -n "$diag" ]]; then
  printf 'DIAG: %s\n' "$diag"
fi

# Write a small machine-parsable receipt (latest for this surface).
mkdir -p "${repo_root}/receipts/validate" >/dev/null 2>&1 || true
ts_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
{
  printf 'VALIDATE.UTC: %s\n' "$ts_utc"
  printf 'SURFACE: %s\n' "$surface"
  printf 'STEP.1: %s\n' 'cf:worker:smoke'
  printf 'STEP.2: %s\n' 'access:probe'
  printf 'STEP.3: %s\n' 'ws:probe'
  printf 'STEP.4: %s\n' 'ws:proof --mode headless'
  printf 'ENDPOINT.V1_IDENTITY: %s\n' "${identity:-unknown}"
  printf 'ENDPOINT.V1_CONVERSATIONS: %s\n' "${conversations:-unknown}"
  printf 'ENDPOINT.V1_SEMANTIC_SEARCH: %s\n' "${semantic:-unknown}"
  printf 'WS.PROBE.URL: %s\n' "$ws_probe_url"
  printf 'WS.PROBE.UPGRADE_HTTP_STATUS: %s\n' "${ws_probe_upgrade_status:-unknown}"
  printf 'WS.PROBE.SEC_WEBSOCKET_ACCEPT: %s\n' "${ws_probe_upgrade_accept:-}"
  printf 'WS.PROOF.URL: %s\n' "$ws_url"
  printf 'WS.PROOF.MODE: %s\n' "$ws_proof_mode"
  printf 'WS.PROOF.CONNECTED: %s\n' "${ws_proof_connected:-unknown}"
  printf 'WS.PROOF.PONG_RECEIVED: %s\n' "${ws_proof_pong_received:-unknown}"
  printf 'WS.PROOF.HANDSHAKE_HTTP_STATUS: %s\n' "${ws_proof_handshake_http_status:-}"
  printf 'WS.PROOF.EXIT_CODE: %s\n' "$ws_proof_exit_code"
  if [[ -n "$diag" ]]; then
    printf 'DIAG: %s\n' "$diag"
  fi
} >"${repo_root}/receipts/validate/latest.${surface}.txt"
