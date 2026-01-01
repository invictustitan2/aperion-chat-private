#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# ws:probe
#
# HTTP-level probe for the WebSocket endpoint path.
#
# Why this exists:
# - WS failures often surface as close(1006) without useful detail.
# - This probe helps distinguish:
#   - Access redirect vs 401 vs worker-level auth denial
#   - DO-level "missing Upgrade" behavior (often 426)
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Network must be opt-in via RUN_NETWORK_TESTS=1.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
# shellcheck source=devshell/lib/surfaces.sh
source "${repo_root}/devshell/lib/surfaces.sh"
# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

surface="api"
base_url_override=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --surface)
      surface="${2:-}"
      shift 2
      ;;
    --base-url)
      base_url_override="${2:-}"
      shift 2
      ;;
    *)
      devshell_die "unknown arg: $1"
      ;;
  esac
done

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
  exit 3
fi

BASE_URL="$(devshell_api_base_url_resolve "$surface" "$base_url_override")"
URL="${BASE_URL}/v1/ws"

first_status_line() { awk 'NR==1 {print; exit}'; }
first_header() {
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
  local line="$1"
  line="${line%$'\r'}"
  line="${line#Location: }"
  line="${line#location: }"
  line="${line%%\?*}"
  line="${line#http://}"
  line="${line#https://}"
  printf '%s' "$line"
}

status_from_headers() {
  local headers="$1"
  local status_line
  status_line="$(printf '%s\n' "$headers" | first_status_line)"
  printf '%s' "$(printf '%s\n' "$status_line" | awk '{print $2}' | head -n 1)"
}

header_value_from_headers() {
  local headers="$1"
  local header_name="$2"
  local line
  line="$(printf '%s\n' "$headers" | first_header "$header_name")"
  if [[ -n "$line" ]]; then
    header_value "$line"
  fi
}

location_sanitized_from_headers() {
  local headers="$1"
  local line
  line="$(printf '%s\n' "$headers" | first_header location)"
  if [[ -n "$line" ]]; then
    strip_location_query "$line"
  fi
}

curl_headers_only() {
  local with_token="$1"
  local url="$2"

  if [[ "$with_token" == 'yes' ]]; then
    aperion_secrets_load
    aperion_secrets_validate >/dev/null

    cat <<EOF | curl -sS --max-time 10 -D - -o /dev/null -K -
url = "${url}"
request = "GET"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
  else
    cat <<EOF | curl -sS --max-time 10 -D - -o /dev/null -K -
url = "${url}"
request = "GET"
EOF
  fi
}

curl_body_only() {
  local with_token="$1"
  local url="$2"

  if [[ "$with_token" == 'yes' ]]; then
    aperion_secrets_load
    aperion_secrets_validate >/dev/null

    cat <<EOF | curl -sS --max-time 10 -o - -K -
url = "${url}"
request = "GET"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
  else
    cat <<EOF | curl -sS --max-time 10 -o - -K -
url = "${url}"
request = "GET"
EOF
  fi
}

curl_headers_upgrade() {
  local with_token="$1"
  local url="$2"

  # Minimal WebSocket handshake headers.
  # We only inspect the response headers; we do not keep the connection open.
  if [[ "$with_token" == 'yes' ]]; then
    aperion_secrets_load
    aperion_secrets_validate >/dev/null

    cat <<EOF | curl -sS --max-time 10 --http1.1 -D - -o /dev/null -K -
url = "${url}"
request = "GET"
header = "Connection: Upgrade"
header = "Upgrade: websocket"
header = "Sec-WebSocket-Version: 13"
header = "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
  else
    cat <<EOF | curl -sS --max-time 10 --http1.1 -D - -o /dev/null -K -
url = "${url}"
request = "GET"
header = "Connection: Upgrade"
header = "Upgrade: websocket"
header = "Sec-WebSocket-Version: 13"
header = "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
EOF
  fi
}

print_case() {
  local label="$1"
  local with_token="$2"
  local headers="$3"

  local status content_type cf_ray server location
  status="$(status_from_headers "$headers")"
  content_type="$(header_value_from_headers "$headers" content-type)"
  cf_ray="$(header_value_from_headers "$headers" cf-ray)"
  server="$(header_value_from_headers "$headers" server)"
  location="$(location_sanitized_from_headers "$headers")"

  printf '%s.http_status: %s\n' "$label" "${status:-unknown}"
  printf '%s.content-type: %s\n' "$label" "${content_type:-}"
  printf '%s.cf-ray: %s\n' "$label" "${cf_ray:-}"
  printf '%s.server: %s\n' "$label" "${server:-}"
  printf '%s.location: %s\n' "$label" "${location:-}"

  # Only print a body prefix when response is JSON.
  if [[ "$content_type" == application/json* ]]; then
    body="$(curl_body_only "$with_token" "$URL" || true)"
    prefix="$(printf '%s' "$body" | tr '\n' ' ' | tr '\r' ' ' | head -c 220)"
    printf '%s.body_json_prefix: %s\n' "$label" "$prefix"
  fi
}

printf 'BASE_URL: %s\n' "$BASE_URL"
printf 'URL: %s\n' "$URL"

headers_with="$(curl_headers_only yes "$URL" || true)"
headers_without="$(curl_headers_only no "$URL" || true)"

print_case 'with_service_token' yes "$headers_with"
print_case 'without_service_token' no "$headers_without"

# Upgrade handshake evidence (service-token only; unauth will just redirect).
upgrade_headers="$(curl_headers_upgrade yes "$URL" || true)"
upgrade_status="$(status_from_headers "$upgrade_headers")"
upgrade_ct="$(header_value_from_headers "$upgrade_headers" content-type)"
upgrade_loc="$(location_sanitized_from_headers "$upgrade_headers")"
upgrade_accept="$(header_value_from_headers "$upgrade_headers" sec-websocket-accept)"

printf 'with_service_token.upgrade.http_status: %s\n' "${upgrade_status:-unknown}"
printf 'with_service_token.upgrade.content-type: %s\n' "${upgrade_ct:-}"
printf 'with_service_token.upgrade.location: %s\n' "${upgrade_loc:-}"
printf 'with_service_token.upgrade.sec-websocket-accept: %s\n' "${upgrade_accept:-}"
