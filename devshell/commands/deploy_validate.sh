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

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'VALIDATE.VERSION: 1'
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network validation.'
  exit 0
fi

worker_smoke_out="$(./dev cf:worker:smoke 2>&1 || true)"
access_probe_out="$(./dev access:probe 2>&1 || true)"

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

printf '%s\n' 'VALIDATE.VERSION: 1'
printf 'ENDPOINT.V1_IDENTITY: %s\n' "${identity:-unknown}"
printf 'ENDPOINT.V1_CONVERSATIONS: %s\n' "${conversations:-unknown}"
printf 'ENDPOINT.V1_SEMANTIC_SEARCH: %s\n' "${semantic:-unknown}"
if [[ -n "$diag" ]]; then
  printf 'DIAG: %s\n' "$diag"
fi
