#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# access:probe
#
# Probes https://api.aperion.cc/v1/identity with:
#   (a) service token headers
#   (b) no service token headers
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Headers provided via curl -K - (stdin config).

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

curl_headers() {
  local with_token="$1"
  local url="$2"
  local method="$3"

  local headers

  if [[ "$with_token" == 'yes' ]]; then
    # Load + validate service token values from env or secrets file.
    aperion_secrets_load
    aperion_secrets_validate >/dev/null

    headers="$(cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${url}"
request = "${method}"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
)"
  else
    headers="$(cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${url}"
request = "${method}"
EOF
)"
  fi

  printf '%s' "$headers"
}

print_probe() {
  local label="$1"
  local headers="$2"

  local status_line
  status_line="$(printf '%s\n' "$headers" | first_status_line)"

  local status
  status="$(printf '%s\n' "$status_line" | awk '{print $2}' | head -n 1)"

  local location_line cf_ray_line server_line content_type_line cache_status_line
  location_line="$(printf '%s\n' "$headers" | first_header location)"
  cf_ray_line="$(printf '%s\n' "$headers" | first_header cf-ray)"
  server_line="$(printf '%s\n' "$headers" | first_header server)"
  content_type_line="$(printf '%s\n' "$headers" | first_header content-type)"
  cache_status_line="$(printf '%s\n' "$headers" | first_header cf-cache-status)"

  printf '%s.http_status: %s\n' "$label" "${status:-unknown}"

  if [[ -n "$location_line" ]]; then
    printf '%s.location: %s\n' "$label" "$(strip_location_query "$location_line")"
  else
    printf '%s.location:\n' "$label"
  fi

  if [[ -n "$cf_ray_line" ]]; then
    printf '%s.cf-ray: %s\n' "$label" "${cf_ray_line#*: }" | sed 's/\r$//'
  else
    printf '%s.cf-ray:\n' "$label"
  fi

  if [[ -n "$server_line" ]]; then
    printf '%s.server: %s\n' "$label" "$(header_value "$server_line")"
  else
    printf '%s.server:\n' "$label"
  fi

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

  # Print x-aperion-* hint headers if present (safe; no secrets).
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

  printf '\nENDPOINT: %s\n' "$endpoint_name"
  printf 'PATH: %s\n' "$path"
  printf 'METHOD: %s\n' "$method"

  local headers_with headers_without
  headers_with="$(curl_headers yes "$url" "$method" || true)"
  headers_without="$(curl_headers no "$url" "$method" || true)"

  local out_with out_without status_with status_without
  out_with="$(print_probe "with_service_token.${endpoint_name}" "$headers_with")"
  printf '%s\n' "$out_with"
  status_with="$(printf '%s\n' "$out_with" | tail -n 1)"

  out_without="$(print_probe "without_service_token.${endpoint_name}" "$headers_without")"
  printf '%s\n' "$out_without"
  status_without="$(printf '%s\n' "$out_without" | tail -n 1)"

  # Endpoint-level classification (evidence-driven).
  if [[ "$status_without" == '401' && "$status_with" == '404' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'ENDPOINT_MISSING_OR_DEPLOY_MISMATCH_NOT_ACCESS_ROUTING'
    printf 'diag.%s.hint: %s\n' "$endpoint_name" 'Access is enforcing auth (401 without token). Service-token request is not being redirected (so auth is likely accepted), but the endpoint path is missing or you are hitting a deployed version that does not serve it.'
  elif [[ "$status_with" == '302' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'ACCESS_SERVICE_AUTH_REDIRECT'
  fi

  printf '%s\n' "$endpoint_name=$status_with/$status_without" >/dev/null
}

main() {
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
    exit 3
  fi

  printf 'BASE_URL: %s\n' "$BASE_URL"

  # Canonical endpoint list for evidence:
  # - HEAD for fast header-only where typically supported
  # - GET for semantic search (often 405 on HEAD)
  probe_one 'ROOT' '/' 'HEAD'
  probe_one 'V1_IDENTITY' '/v1/identity' 'HEAD'
  probe_one 'V1_CONVERSATIONS' '/v1/conversations' 'HEAD'
  probe_one 'V1_SEMANTIC_SEARCH' '/v1/semantic/search?query=test' 'GET'

  printf '\nNEXT: %s\n' 'If you see 404 only on specific endpoints (with service token), that points to endpoint availability / deployed version mismatch, not Access routing.'
  printf '%s\n' 'Tip: Run RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke for a single “what exists in prod” receipt (service-token only).'
}

main "$@"
