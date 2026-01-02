#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# pwa:probe
#
# Probe whether public PWA/static assets on the chat origin are being
# redirected to Cloudflare Access login (which breaks browser fetch via CORS).
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Network must be opt-in via RUN_NETWORK_TESTS=1.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

devshell_require_cmd curl

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
  exit 0
fi

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
timestamp_iso="$(devshell_now_iso_utc)"

origin='https://chat.aperion.cc'

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/}"
  s="${s//$'\r'/}"
  printf '%s' "$s"
}

first_status_line() { awk 'NR==1 {print; exit}'; }

first_header_line() {
  local header_name="$1"
  grep -i -m 1 "^${header_name}:" || true
}

header_value() {
  local line="$1"
  line="${line%$'\r'}"
  line="${line#*: }"
  printf '%s' "$line"
}

strip_location_query() {
  local v="$1"
  v="${v%$'\r'}"
  v="${v%%\?*}"
  printf '%s' "$v"
}

status_from_headers() {
  local headers="$1"
  local status_line
  status_line="$(printf '%s\n' "$headers" | first_status_line)"
  printf '%s' "$(printf '%s\n' "$status_line" | awk '{print $2}' | head -n 1)"
}

probe_one() {
  local path="$1"
  local url="${origin}${path}"
  local headers exit_code status location content_type cf_ray redirected_to_access

  set +e
  headers="$(curl -sS --max-time 10 -D - -o /dev/null "$url" 2>/dev/null)"
  exit_code=$?
  set -e

  status="$(status_from_headers "$headers")"
  if [[ -z "$status" ]]; then
    status=0
  fi

  location=""
  local location_line
  location_line="$(printf '%s\n' "$headers" | first_header_line location)"
  if [[ -n "$location_line" ]]; then
    location="$(strip_location_query "$(header_value "$location_line")")"
  fi

  content_type=""
  local ct_line
  ct_line="$(printf '%s\n' "$headers" | first_header_line content-type)"
  if [[ -n "$ct_line" ]]; then
    content_type="$(header_value "$ct_line")"
  fi

  cf_ray=""
  local ray_line
  ray_line="$(printf '%s\n' "$headers" | first_header_line cf-ray)"
  if [[ -n "$ray_line" ]]; then
    cf_ray="$(header_value "$ray_line")"
  fi

  redirected_to_access='no'
  if [[ -n "$location" ]]; then
    if [[ "$location" == *"cloudflareaccess.com"* ]] || [[ "$location" == *"/cdn-cgi/access/"* ]]; then
      redirected_to_access='yes'
    fi
  fi

  printf '{'
  printf '"path":"%s",' "$(json_escape "$path")"
  printf '"url":"%s",' "$(json_escape "$url")"
  printf '"http_status":%s,' "$status"
  printf '"curl_exit_code":%s,' "$exit_code"
  printf '"location":"%s",' "$(json_escape "$location")"
  printf '"content_type":"%s",' "$(json_escape "$content_type")"
  printf '"cf_ray":"%s",' "$(json_escape "$cf_ray")"
  printf '"redirected_to_access":"%s"' "$redirected_to_access"
  printf '}'
}

manifest_obj="$(probe_one '/manifest.json')"
sw_obj="$(probe_one '/sw.js')"
favicon_obj="$(probe_one '/favicon.ico')"
robots_obj="$(probe_one '/robots.txt')"

manifest_status="$(printf '%s' "$manifest_obj" | sed -n 's/.*"http_status":\([0-9]*\).*/\1/p')"
manifest_redirected="$(printf '%s' "$manifest_obj" | sed -n 's/.*"redirected_to_access":"\([^"]*\)".*/\1/p')"

sw_status="$(printf '%s' "$sw_obj" | sed -n 's/.*"http_status":\([0-9]*\).*/\1/p')"
sw_redirected="$(printf '%s' "$sw_obj" | sed -n 's/.*"redirected_to_access":"\([^"]*\)".*/\1/p')"

pwa_public_ok='no'
if [[ "$manifest_status" == '200' && "$manifest_redirected" != 'yes' && "$sw_status" == '200' && "$sw_redirected" != 'yes' ]]; then
  pwa_public_ok='yes'
fi

receipt_path="${repo_root}/receipts/pwa-probe.${timestamp_compact}.json"
latest_path="${repo_root}/receipts/pwa-probe.latest.json"

{
  printf '{'
  printf '"schemaVersion":1,'
  printf '"timestamp":"%s",' "$(json_escape "$timestamp_iso")"
  printf '"origin":"%s",' "$(json_escape "$origin")"
  printf '"probes":[%s,%s,%s,%s],' "$manifest_obj" "$sw_obj" "$favicon_obj" "$robots_obj"
  printf '"summary":{'
  printf '"PWA_PUBLIC_OK":"%s"' "$pwa_public_ok"
  printf '}'
  printf '}'
  printf '\n'
} >"$receipt_path"

cp "$receipt_path" "$latest_path"

# Stdout: machine-readable JSON (for tee into receipts/*.json)
cat "$receipt_path"

# Stderr: operator-grade summary
printf 'PWA.PUBLIC.OK: %s\n' "$pwa_public_ok" >&2
printf 'RECEIPT: %s\n' "${receipt_path#${repo_root}/}" >&2

if [[ "$pwa_public_ok" != 'yes' ]]; then
  printf '%s\n' 'ACTION: Configure Cloudflare Access bypass for /manifest.json, /sw.js (and other static paths); see docs/ACCESS_PWA_BYPASS.md' >&2
fi
