#!/usr/bin/env bash
set -euo pipefail

# Local-only interactive production smoke runner.
# - Prompts for Cloudflare Access service token (secret input hidden)
# - Never prints or writes token values
# - Appends non-secret evidence to docs/DEPLOY_PROD_EVIDENCE.md

API_BASE_URL="https://api.aperion.cc"
WS_SMOKE_PATH="scripts/smoke-ws.mjs"
EVIDENCE_FILE="docs/DEPLOY_PROD_EVIDENCE.md"

# ---------- helpers ----------

ensure_repo_root() {
  # Ensure script runs from repo root so relative paths are stable.
  if [ ! -f "package.json" ] || [ ! -d "scripts" ]; then
    echo "ERROR: run from repo root (expected package.json + ./scripts)." >&2
    exit 2
  fi
}

ensure_evidence_file() {
  if [ ! -f "$EVIDENCE_FILE" ]; then
    mkdir -p "$(dirname "$EVIDENCE_FILE")"
    printf '%s\n' "# Production Deploy Evidence" > "$EVIDENCE_FILE"
  fi
}

first_status_line() {
  awk 'NR==1 {print; exit}'
}

headers_only() {
  # Given a curl -i response, return only the header block (status line + headers).
  # Stops at the first empty line.
  awk '{print} /^\r?$/ {exit}'
}

first_header_line() {
  # $1 = header name (case-insensitive, no trailing colon)
  local header_name="$1"
  grep -i -m 1 "^${header_name}:" || true
}

require_http_200() {
  local label="$1"
  local status_line="$2"

  if ! printf '%s' "$status_line" | grep -qE 'HTTP/[0-9.]+\s+200(\s|$)'; then
    echo "ERROR: ${label} expected 200, got: ${status_line}" >&2
    return 1
  fi
}

extract_ws_summary() {
  local out="$1"
  local open_line close_line error_line

  open_line=$(printf '%s\n' "$out" | grep -E '^event: open$' -m 1 || true)
  close_line=$(printf '%s\n' "$out" | grep -E '^event: close ' -m 1 || true)
  error_line=$(printf '%s\n' "$out" | grep -E '^event: error ' -m 1 || true)

  if [ -n "$open_line" ] && [ -n "$close_line" ]; then
    printf '%s; %s' "$open_line" "$close_line"
    return 0
  fi
  if [ -n "$error_line" ] && [ -n "$close_line" ]; then
    printf '%s; %s' "$error_line" "$close_line"
    return 0
  fi
  if [ -n "$error_line" ]; then
    printf '%s' "$error_line"
    return 0
  fi
  if [ -n "$close_line" ]; then
    printf '%s' "$close_line"
    return 0
  fi
  printf 'no ws event lines captured'
}

prompt_for_tokens() {
  local id_var secret_var

  read -r -p "CF Access Service Token Client ID: " id_var
  read -r -s -p "CF Access Service Token Client Secret (hidden): " secret_var
  echo

  if [ -z "$id_var" ] || [ -z "$secret_var" ]; then
    echo "ERROR: both Client ID and Client Secret are required." >&2
    exit 3
  fi

  # Return via stdout as two lines: ID then SECRET (caller captures safely).
  printf '%s\n%s\n' "$id_var" "$secret_var"
}

curl_unauth() {
  local url="$1"
  curl -sS -i "$url" || true
}

curl_auth() {
  local url="$1"
  local token_id="$2"
  local token_secret="$3"

  # Intentionally avoid -v. Do not echo headers.
  curl -sS -i \
    -H "CF-Access-Client-Id: ${token_id}" \
    -H "CF-Access-Client-Secret: ${token_secret}" \
    "$url"
}

run_ws_smoke() {
  # Run the WS smoke script with a guaranteed WebSocket implementation (undici).
  # If CF_ACCESS_SERVICE_TOKEN_* env vars are set for this process, smoke-ws.mjs can use them.
  node --input-type=module -e "
    import { WebSocket } from 'undici';
    import { pathToFileURL } from 'node:url';
    globalThis.WebSocket = WebSocket;
    const url = pathToFileURL(process.cwd() + '/$WS_SMOKE_PATH');
    await import(url.href);
  " 2>&1 || true
}

append_evidence() {
  local ts="$1" sha="$2"
  local unauth_identity_status="$3" auth_identity_status="$4" auth_pref_status="$5"
  local unauth_ws_summary="$6" auth_ws_summary="$7"

  {
    echo
    echo "---"
    echo "## Runtime smoke (interactive)"
    echo "- Timestamp (UTC): ${ts}"
    echo "- Commit: ${sha}"
    echo ""
    echo "### HTTP status lines"
    echo "- Unauth identity: ${unauth_identity_status}"
    echo "- Auth identity: ${auth_identity_status}"
    echo "- Auth preference ai.tone: ${auth_pref_status}"
    echo ""
    echo "### WebSocket summaries"
    echo "- Unauth WS: ${unauth_ws_summary}"
    echo "- Auth WS: ${auth_ws_summary}"
  } >> "$EVIDENCE_FILE"
}

# ---------- main ----------

main() {
  ensure_repo_root
  ensure_evidence_file

  local ts sha
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  sha=$(git rev-parse --short HEAD)

  echo "Running unauthenticated HTTP smoke..."
  local unauth_identity_raw unauth_identity_status
  unauth_identity_raw=$(curl_unauth "${API_BASE_URL}/v1/identity")
  unauth_identity_status=$(printf '%s\n' "$unauth_identity_raw" | first_status_line)

  echo "Running unauthenticated WS smoke..."
  local unauth_ws_out unauth_ws_summary
  unauth_ws_out=$(run_ws_smoke)
  unauth_ws_summary=$(extract_ws_summary "$unauth_ws_out")

  echo "Prompting for Access service token (never printed, never written)..."
  local token_lines token_id token_secret
  token_lines="$(prompt_for_tokens)"
  token_id="$(printf '%s\n' "$token_lines" | sed -n '1p')"
  token_secret="$(printf '%s\n' "$token_lines" | sed -n '2p')"

  echo "Running authenticated HTTP smoke..."
  local auth_identity_raw auth_identity_status
  auth_identity_raw=$(curl_auth "${API_BASE_URL}/v1/identity" "$token_id" "$token_secret")
  auth_identity_status=$(printf '%s\n' "$auth_identity_raw" | first_status_line)
  if ! printf '%s' "$auth_identity_status" | grep -qE 'HTTP/[0-9.]+\s+200(\s|$)'; then
    local auth_identity_headers auth_identity_location auth_identity_cf_ray
    auth_identity_headers=$(printf '%s\n' "$auth_identity_raw" | headers_only)
    auth_identity_location=$(printf '%s\n' "$auth_identity_headers" | first_header_line "location")
    auth_identity_cf_ray=$(printf '%s\n' "$auth_identity_headers" | first_header_line "cf-ray")

    echo "ERROR: auth identity expected 200, got: ${auth_identity_status}" >&2
    if [ -n "$auth_identity_location" ]; then
      echo "ERROR: ${auth_identity_location}" >&2
    fi
    if [ -n "$auth_identity_cf_ray" ]; then
      echo "ERROR: ${auth_identity_cf_ray}" >&2
    fi
    echo "HINT: Auth 302 means Access rejected the service token for this app/hostname/path; verify Access Application + service token policy association." >&2
    exit 3
  fi

  local auth_pref_raw auth_pref_status
  auth_pref_raw=$(curl_auth "${API_BASE_URL}/v1/preferences/ai.tone" "$token_id" "$token_secret")
  auth_pref_status=$(printf '%s\n' "$auth_pref_raw" | first_status_line)
  require_http_200 "auth preference ai.tone" "$auth_pref_status"

  echo "Running authenticated WS smoke..."
  local auth_ws_out auth_ws_summary
  auth_ws_out=$(
    CF_ACCESS_SERVICE_TOKEN_ID="$token_id" \
    CF_ACCESS_SERVICE_TOKEN_SECRET="$token_secret" \
    run_ws_smoke
  )
  auth_ws_summary=$(extract_ws_summary "$auth_ws_out")

  append_evidence \
    "$ts" "$sha" \
    "$unauth_identity_status" "$auth_identity_status" "$auth_pref_status" \
    "$unauth_ws_summary" "$auth_ws_summary"

  echo "OK: authenticated HTTP checks returned 200; evidence appended to ${EVIDENCE_FILE}"
}

main "$@"
