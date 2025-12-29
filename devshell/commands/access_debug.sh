#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

API_URL="https://api.aperion.cc/v1/identity"

first_status_line() {
  awk 'NR==1 {print; exit}'
}

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

  # Print hostname/path only
  line="${line#http://}"
  line="${line#https://}"
  printf '%s' "$line"
}

curl_headers_auth() {
  local url="$1"

  headers=$(cat <<EOF | curl -sS -D - -o /dev/null -K -
url = "${url}"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
)
  printf '%s' "$headers"
}

main() {
  echo "== Access debug (safe; no secrets) =="

  aperion_secrets_load
  aperion_secrets_validate >/dev/null

  local headers
  headers="$(curl_headers_auth "$API_URL" || true)"

  local status_line
  status_line="$(printf '%s\n' "$headers" | first_status_line)"

  local status_code
  status_code="$(printf '%s\n' "$status_line" | awk '{print $2}')"

  local location_line
  location_line="$(printf '%s\n' "$headers" | first_header "location")"

  echo "HTTP status: ${status_code:-unknown}"

  if [[ -n "$location_line" ]]; then
    echo "Location: $(strip_location_query "$location_line")"
  fi

  case "${status_code:-}" in
    200)
      echo "Result: success (service token accepted)."
      exit 0
      ;;

    301|302)
      echo "Result: redirect from Access (likely service auth not applied or not matching)."
      echo "Likely causes checklist:"
      echo "- Access policy for this app must include a Service Auth rule (Action=SERVICE AUTH), not just ALLOW."
      echo "- Access app hostname/path must match: api.aperion.cc and /v1/* (or broader)."
      echo "- Enable 'Return 401 Response for Service Auth policies' to avoid redirects."
      echo "- Confirm policy changes are saved/published (no pending drafts)."
      exit 10
      ;;

    401)
      echo "Result: service auth reached but rejected (token/policy mismatch)."
      exit 11
      ;;

    403)
      echo "Result: forbidden (Access/Worker rejected)."
      exit 12
      ;;

    *)
      echo "Result: unexpected response; inspect Access configuration."
      exit 13
      ;;
  esac
}

main "$@"
