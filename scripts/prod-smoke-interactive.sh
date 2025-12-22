#!/usr/bin/env bash
set -euo pipefail

# Local-only interactive production smoke runner.
# - Prompts for Cloudflare Access service token (secret input hidden)
# - Never prints or writes token values
# - Appends non-secret evidence to docs/DEPLOY_PROD_EVIDENCE.md

API_BASE_URL="https://api.aperion.cc"
WS_SMOKE_IMPORT="./scripts/smoke-ws.mjs"
EVIDENCE_FILE="docs/DEPLOY_PROD_EVIDENCE.md"

redact() {
  local s="${1:-}"

  # Defensively redact known env var values if they accidentally appear.
  if [ -n "${CF_ACCESS_SERVICE_TOKEN_ID:-}" ]; then
    s="${s//${CF_ACCESS_SERVICE_TOKEN_ID}/[REDACTED_TOKEN_ID]}"
  fi
  if [ -n "${CF_ACCESS_SERVICE_TOKEN_SECRET:-}" ]; then
    s="${s//${CF_ACCESS_SERVICE_TOKEN_SECRET}/[REDACTED_TOKEN_SECRET]}"
  fi

  # Redact headers if they appear.
  s="${s//CF-Access-Client-Id: */CF-Access-Client-Id: [REDACTED]}"
  s="${s//CF-Access-Client-Secret: */CF-Access-Client-Secret: [REDACTED]}"

  printf '%s' "$s"
}

first_status_line() {
  # Extract the first HTTP status line from a curl -i response.
  # e.g. "HTTP/2 302" or "HTTP/1.1 200 OK"
  awk 'NR==1 {print; exit}'
}

extract_ws_summary() {
  # Given smoke-ws output, summarize key event lines.
  # Prefer open + close if present, otherwise error + close.
  local out="$1"
  local open_line
  local close_line
  local error_line

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

ensure_evidence_file() {
  if [ ! -f "$EVIDENCE_FILE" ]; then
    mkdir -p "$(dirname "$EVIDENCE_FILE")"
    cat > "$EVIDENCE_FILE" << 'EOF'
# Production Deploy Evidence
EOF
  fi
}

prompt_for_tokens() {
  if [ -z "${CF_ACCESS_SERVICE_TOKEN_ID:-}" ]; then
    read -r -p "CF Access Service Token Client ID: " CF_ACCESS_SERVICE_TOKEN_ID
  fi

  if [ -z "${CF_ACCESS_SERVICE_TOKEN_SECRET:-}" ]; then
    read -r -s -p "CF Access Service Token Client Secret (hidden): " CF_ACCESS_SERVICE_TOKEN_SECRET
    echo
  fi

  export CF_ACCESS_SERVICE_TOKEN_ID
  export CF_ACCESS_SERVICE_TOKEN_SECRET
}

curl_auth() {
  local url="$1"

  # Intentionally avoid -v. Do not echo headers.
  curl -sS -i \
    -H "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}" \
    -H "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}" \
    "$url"
}

curl_unauth() {
  local url="$1"
  curl -sS -i "$url"
}

ws_smoke_unauth() {
  # Use script directly; it will fail if WebSocket is missing.
  node "$WS_SMOKE_IMPORT" 2>&1 || true
}

ws_smoke_auth() {
  # Provide undici WebSocket if global WebSocket is missing.
  # Env vars are read by scripts/smoke-ws.mjs; do not print them.
  node --input-type=module -e "import { WebSocket } from 'undici'; import { pathToFileURL } from 'node:url'; globalThis.WebSocket = WebSocket; const url = pathToFileURL(process.cwd() + '/scripts/smoke-ws.mjs'); await import(url.href);" 2>&1 || true
}

main() {
  ensure_evidence_file

  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local sha
  sha=$(git rev-parse --short HEAD)

  echo "Running unauthenticated HTTP smoke..."
  local unauth_identity_raw
  unauth_identity_raw=$(curl_unauth "${API_BASE_URL}/v1/identity" || true)
  local unauth_identity_status
  unauth_identity_status=$(printf '%s\n' "$unauth_identity_raw" | first_status_line)

  echo "Running unauthenticated WS smoke..."
  local unauth_ws_out
  unauth_ws_out=$(ws_smoke_unauth)

  echo "Prompting for Access service token (not stored)..."
  prompt_for_tokens

  echo "Running authenticated HTTP smoke..."
  local auth_identity_raw
  auth_identity_raw=$(curl_auth "${API_BASE_URL}/v1/identity")
  local auth_identity_status
  auth_identity_status=$(printf '%s\n' "$auth_identity_raw" | first_status_line)

  if ! printf '%s' "$auth_identity_status" | grep -qE '\s200(\s|$)'; then
    echo "ERROR: authenticated identity check expected 200, got: $(redact "$auth_identity_status")" >&2
    exit 3
  fi

  local auth_pref_raw
  auth_pref_raw=$(curl_auth "${API_BASE_URL}/v1/preferences/ai.tone")
  local auth_pref_status
  auth_pref_status=$(printf '%s\n' "$auth_pref_raw" | first_status_line)

  echo "Running authenticated WS smoke..."
  local auth_ws_out
  auth_ws_out=$(ws_smoke_auth)

  local unauth_ws_summary
  unauth_ws_summary=$(extract_ws_summary "$(redact "$unauth_ws_out")")

  local auth_ws_summary
  auth_ws_summary=$(extract_ws_summary "$(redact "$auth_ws_out")")

  # Append evidence (non-secret). Redact defensively even though status lines should not contain secrets.
  {
    echo
    echo "---"
    echo "## Runtime smoke (interactive)"
    echo "- Timestamp (UTC): ${ts}"
    echo "- Commit: ${sha}"
    echo ""
    echo "### HTTP status lines"
    echo "- Unauth identity: $(redact "$unauth_identity_status")"
    echo "- Auth identity: $(redact "$auth_identity_status")"
    echo "- Auth preference ai.tone: $(redact "$auth_pref_status")"
    echo ""
    echo "### WebSocket summaries"
    echo "- Unauth WS: $(redact "$unauth_ws_summary")"
    echo "- Auth WS: $(redact "$auth_ws_summary")"
  } >> "$EVIDENCE_FILE"

  echo "OK: authenticated identity returned 200; evidence appended to ${EVIDENCE_FILE}"
}

main "$@"
