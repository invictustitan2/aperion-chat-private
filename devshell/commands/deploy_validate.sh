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

ws_url=''
if [[ "$surface" == 'api' ]]; then
  ws_url='wss://api.aperion.cc/v1/ws'
else
  ws_url='wss://chat.aperion.cc/api/v1/ws'
fi

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'VALIDATE.VERSION: 2'
  printf 'SURFACE: %s\n' "$surface"
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network validation.'
  exit 0
fi

worker_smoke_out="$(./dev cf:worker:smoke --surface "$surface" 2>&1 || true)"
access_probe_out="$(./dev access:probe --surface "$surface" 2>&1 || true)"

# Load + validate service token values from env or secrets file so WS smoke can
# send headers via env (never printed).
aperion_secrets_load
aperion_secrets_validate >/dev/null

ws_out=''
ws_exit_code=0
set +e
ws_out="$(WS_URL="$ws_url" TIMEOUT_MS=10000 node scripts/smoke-ws.mjs 2>&1)"
ws_exit_code=$?
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

ws_open='no'
ws_close_code=''
if [[ "$ws_out" == *"event: open"* ]]; then
  ws_open='yes'
fi
ws_close_code="$(printf '%s\n' "$ws_out" | sed -n 's/^event: close code=\([0-9][0-9]*\) .*$/\1/p' | head -n 1)"

ws_diag="$(
  printf '%s\n' "$ws_out" |
    sed -n 's/^\(error:.*\)$/\1/p; s/^\(timeout:.*\)$/\1/p; s/^\(event: error.*\)$/\1/p; s/^\(event: close.*\)$/\1/p' |
    head -n 1
)"

ws_result='unknown'
if [[ "$ws_open" == 'yes' && "$ws_close_code" == '1000' ]]; then
  ws_result='ok'
elif [[ "$ws_out" == *"timeout:"* ]]; then
  ws_result='timeout'
elif [[ "$ws_out" == error:* || "$ws_out" == *"event: error"* || "$ws_exit_code" -ne 0 ]]; then
  ws_result='error'
fi

printf '%s\n' 'VALIDATE.VERSION: 2'
printf 'SURFACE: %s\n' "$surface"
printf 'ENDPOINT.V1_IDENTITY: %s\n' "${identity:-unknown}"
printf 'ENDPOINT.V1_CONVERSATIONS: %s\n' "${conversations:-unknown}"
printf 'ENDPOINT.V1_SEMANTIC_SEARCH: %s\n' "${semantic:-unknown}"
printf 'WS.URL: %s\n' "$ws_url"
printf 'WS.OPEN: %s\n' "$ws_open"
printf 'WS.CLOSE_CODE: %s\n' "${ws_close_code:-}"
printf 'WS.EXIT_CODE: %s\n' "$ws_exit_code"
printf 'WS.RESULT: %s\n' "$ws_result"
if [[ -n "$ws_diag" ]]; then
  printf 'WS.DIAG: %s\n' "$ws_diag"
fi
if [[ -n "$diag" ]]; then
  printf 'DIAG: %s\n' "$diag"
fi

# Write a small machine-parsable receipt (latest for this surface).
mkdir -p "${repo_root}/receipts/validate" >/dev/null 2>&1 || true
ts_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
{
  printf 'VALIDATE.UTC: %s\n' "$ts_utc"
  printf 'SURFACE: %s\n' "$surface"
  printf 'ENDPOINT.V1_IDENTITY: %s\n' "${identity:-unknown}"
  printf 'ENDPOINT.V1_CONVERSATIONS: %s\n' "${conversations:-unknown}"
  printf 'ENDPOINT.V1_SEMANTIC_SEARCH: %s\n' "${semantic:-unknown}"
  printf 'WS.URL: %s\n' "$ws_url"
  printf 'WS.OPEN: %s\n' "$ws_open"
  printf 'WS.CLOSE_CODE: %s\n' "${ws_close_code:-}"
  printf 'WS.EXIT_CODE: %s\n' "$ws_exit_code"
  printf 'WS.RESULT: %s\n' "$ws_result"
  if [[ -n "$ws_diag" ]]; then
    printf 'WS.DIAG: %s\n' "$ws_diag"
  fi
  if [[ -n "$diag" ]]; then
    printf 'DIAG: %s\n' "$diag"
  fi
} >"${repo_root}/receipts/validate/latest.${surface}.txt"
