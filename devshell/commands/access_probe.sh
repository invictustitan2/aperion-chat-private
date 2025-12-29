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

URL="https://api.aperion.cc/v1/identity"

# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

first_status_line() { awk 'NR==1 {print; exit}'; }
first_header() {
  local header_name="$1"
  grep -i -m 1 "^${header_name}:" || true
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

  local headers

  if [[ "$with_token" == 'yes' ]]; then
    # Load + validate service token values from env or secrets file.
    aperion_secrets_load
    aperion_secrets_validate >/dev/null

    headers="$(cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${URL}"
request = "HEAD"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
)"
  else
    headers="$(cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${URL}"
request = "HEAD"
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

  local location_line cf_ray_line server_line
  location_line="$(printf '%s\n' "$headers" | first_header location)"
  cf_ray_line="$(printf '%s\n' "$headers" | first_header cf-ray)"
  server_line="$(printf '%s\n' "$headers" | first_header server)"

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
    printf '%s.server: %s\n' "$label" "${server_line#*: }" | sed 's/\r$//'
  else
    printf '%s.server:\n' "$label"
  fi

  printf '%s\n' "$status"
}

main() {
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
    exit 3
  fi

  printf 'URL: %s\n' "$URL"

  local headers_with headers_without
  headers_with="$(curl_headers yes || true)"
  headers_without="$(curl_headers no || true)"

  local out_with out_without status_with status_without
  out_with="$(print_probe 'with_service_token' "$headers_with")"
  printf '%s\n' "$out_with"
  status_with="$(printf '%s\n' "$out_with" | tail -n 1)"

  out_without="$(print_probe 'without_service_token' "$headers_without")"
  printf '%s\n' "$out_without"
  status_without="$(printf '%s\n' "$out_without" | tail -n 1)"

  # Deterministic next actions.
  if [[ "$status_with" == '302' ]]; then
    printf '\nDIAG: service-token request received 302 redirect.\n'
    printf '%s\n' 'Next actions (evidence-based):'
    printf '%s\n' '- Run: ./dev cf:access:audit'
    printf '%s\n' '  Confirm in output:'
    printf '%s\n' '  - APP_MATCH_COUNT.API is exactly 1'
    printf '%s\n' '  - APP.API.0.POLICY.*.DECISION shows SERVICE_AUTH / NON_IDENTITY (or equivalent)'
    printf '%s\n' '  - APP.API.0.POLICY.*.HAS_SERVICE_TOKEN_REF is yes for the intended service token'
    printf '%s\n' '  - APP.API.0.PATHS include /v1/* (or a broader match that covers /v1/identity)'
    printf '%s\n' 'Also check in Zero Trust UI:'
    printf '%s\n' '- Enable “Return 401 Response for Service Auth policies” to avoid login redirects'
    printf '%s\n' '- Re-save policies (publish) if you suspect drafts'
  fi

  if [[ "$status_without" == '200' ]]; then
    printf '\nWARN: unauthenticated request returned 200 (API may not be protected by Access).\n'
  fi
}

main "$@"
