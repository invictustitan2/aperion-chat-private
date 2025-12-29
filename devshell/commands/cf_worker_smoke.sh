#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:worker:smoke
#
# Purpose: produce a receipt answering: "Which endpoints exist in prod right now?"
# Probes a canonical endpoint list against https://api.aperion.cc using Access
# service-token headers (passed only via curl -K - stdin config).
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Network must be opt-in (RUN_NETWORK_TESTS=1).

BASE_URL="https://api.aperion.cc"

# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

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

curl_headers() {
  local url="$1"
  local method="$2"

  aperion_secrets_load
  aperion_secrets_validate >/dev/null

  cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${url}"
request = "${method}"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
}

print_probe() {
  local label="$1"
  local headers="$2"

  local status_line
  status_line="$(printf '%s\n' "$headers" | first_status_line)"

  local status
  status="$(printf '%s\n' "$status_line" | awk '{print $2}' | head -n 1)"

  local cf_ray_line server_line content_type_line cache_status_line
  cf_ray_line="$(printf '%s\n' "$headers" | first_header cf-ray)"
  server_line="$(printf '%s\n' "$headers" | first_header server)"
  content_type_line="$(printf '%s\n' "$headers" | first_header content-type)"
  cache_status_line="$(printf '%s\n' "$headers" | first_header cf-cache-status)"

  printf '%s.http_status: %s\n' "$label" "${status:-unknown}"

  if [[ -n "$content_type_line" ]]; then
    printf '%s.content-type: %s\n' "$label" "$(header_value "$content_type_line")"
  else
    printf '%s.content-type:\n' "$label"
  fi

  if [[ -n "$cache_status_line" ]]; then
    printf '%s.cf-cache-status: %s\n' "$label" "$(header_value "$cache_status_line")"
  else
    printf '%s.cf-cache-status:\n' "$label"
  fi

  if [[ -n "$cf_ray_line" ]]; then
    printf '%s.cf-ray: %s\n' "$label" "$(header_value "$cf_ray_line")"
  else
    printf '%s.cf-ray:\n' "$label"
  fi

  if [[ -n "$server_line" ]]; then
    printf '%s.server: %s\n' "$label" "$(header_value "$server_line")"
  else
    printf '%s.server:\n' "$label"
  fi

  # Only print x-aperion-* hint headers (safe; no secrets).
  local hint_lines hint_count
  hint_lines="$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1} /^x-aperion-[a-z0-9-]+:/{print $0}' | sed 's/\r$//' | head -n 10)"
  hint_count="$(printf '%s\n' "$hint_lines" | grep -c '.' || true)"
  printf '%s.hint_headers.count: %s\n' "$label" "${hint_count:-0}"
  if [[ "${hint_count:-0}" -gt 0 ]]; then
    local idx=0
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      printf '%s.hint_headers.%s: %s\n' "$label" "$idx" "$line"
      idx=$((idx + 1))
    done <<<"$hint_lines"
  fi

  printf '%s\n' "$status"
}

probe_one() {
  local endpoint_name="$1"
  local path="$2"
  local method="$3"

  local url
  url="${BASE_URL}${path}"

  local headers
  headers="$(curl_headers "$url" "$method" || true)"

  local out status
  out="$(print_probe "endpoint.${endpoint_name}" "$headers")"
  printf '%s\n' "$out"
  status="$(printf '%s\n' "$out" | tail -n 1)"

  if [[ "$status" == '404' ]]; then
    printf 'endpoint.%s.exists: no\n' "$endpoint_name"
  else
    printf 'endpoint.%s.exists: yes\n' "$endpoint_name"
  fi
}

main() {
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
    exit 3
  fi

  printf 'BASE_URL: %s\n' "$BASE_URL"

  probe_one 'ROOT' '/' 'HEAD'
  probe_one 'V1_IDENTITY' '/v1/identity' 'HEAD'
  probe_one 'V1_CONVERSATIONS' '/v1/conversations' 'HEAD'
  probe_one 'V1_SEMANTIC_SEARCH' '/v1/semantic/search?query=test' 'GET'
}

main "$@"
