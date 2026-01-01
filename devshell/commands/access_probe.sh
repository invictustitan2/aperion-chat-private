#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# access:probe
#
# Probes a canonical endpoint list against https://api.aperion.cc with:
#   (a) service token headers
#   (b) no service token headers
#
# IMPORTANT: Probes that determine endpoint existence must use GET.
# Some Workers return 404 to HEAD even when GET is routed.
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

print_case() {
  local label="$1"
  local headers="$2"

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
}

probe_one() {
  local endpoint_name="$1"
  local path="$2"
  local method="$3"

  local url
  url="${BASE_URL}${path}"

  local headers_with headers_without
  headers_with="$(curl_headers yes "$url" "$method" || true)"
  headers_without="$(curl_headers no "$url" "$method" || true)"

  local status_with status_without ct_with ct_without
  status_with="$(status_from_headers "$headers_with")"
  status_without="$(status_from_headers "$headers_without")"
  ct_with="$(header_value_from_headers "$headers_with" content-type)"
  ct_without="$(header_value_from_headers "$headers_without" content-type)"

  print_case "with_service_token.${endpoint_name}" "$headers_with"
  print_case "without_service_token.${endpoint_name}" "$headers_without"

  # Endpoint-level classification (evidence-driven; avoids blaming Access routing).
  if [[ "$endpoint_name" == 'ROOT' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'NOT_ROUTED_API_ENDPOINT'
    return 0
  fi

  if [[ "$status_with" == '302' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'ACCESS_SERVICE_AUTH_REDIRECT'
    return 0
  fi

  if [[ "$status_with" == '405' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'METHOD_NOT_ALLOWED'
    return 0
  fi

  if [[ "$status_without" == '401' && "$status_with" == '404' ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'ENDPOINT_MISSING_OR_DEPLOY_MISMATCH_NOT_ACCESS_ROUTING'
    return 0
  fi

  if [[ "$status_without" == '401' && "$status_with" == '401' ]]; then
    if [[ "$ct_without" == text/html* && "$ct_with" == application/json* ]]; then
      printf 'diag.%s: %s\n' "$endpoint_name" 'APP_AUTH_REJECTED_AFTER_ACCESS_SERVICE_AUTH'
    else
      printf 'diag.%s: %s\n' "$endpoint_name" 'AUTH_REJECTED'
    fi
    return 0
  fi

  if [[ "$status_without" == '401' && ( "$status_with" == '200' || "$status_with" == '204' ) ]]; then
    printf 'diag.%s: %s\n' "$endpoint_name" 'OK_SERVICE_TOKEN_ACCEPTED'
    return 0
  fi

  printf 'diag.%s: %s\n' "$endpoint_name" 'UNKNOWN'
}

main() {
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
    exit 3
  fi

  printf 'BASE_URL: %s\n' "$BASE_URL"

  # Canonical endpoint list for evidence:
  # - ROOT is NOT a routed API endpoint; keep HEAD.
  # - Routed endpoints must use GET to avoid false 404s.
  probe_one 'ROOT' '/' 'HEAD'
  probe_one 'V1_IDENTITY' '/v1/identity' 'GET'
  probe_one 'V1_CONVERSATIONS' '/v1/conversations' 'GET'
  probe_one 'V1_SEMANTIC_SEARCH' '/v1/semantic/search?query=test' 'GET'
}

main "$@"
