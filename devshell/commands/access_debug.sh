#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

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

BASE_URL="$(devshell_api_base_url_resolve "$surface" "$base_url_override")"
API_URL="${BASE_URL}/v1/identity"

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

curl_get_body_auth_tmp() {
  local url="$1"
  local tmp_body
  tmp_body="$(mktemp)"

  cat <<EOF | curl -sS -o "$tmp_body" -K -
url = "${url}"
request = "GET"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF

  printf '%s' "$tmp_body"
}

main() {
  echo "== Access debug (safe; no secrets) =="

  local host path_prefix
  host='' ; path_prefix=''
  local _parts
  mapfile -t _parts < <(devshell_split_url_host_and_path_prefix "$BASE_URL")
  host="${_parts[0]:-}"
  path_prefix="${_parts[1]:-}"
  if [[ "$path_prefix" == '/' ]]; then
    path_prefix=''
  fi

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

  local content_type_line
  content_type_line="$(printf '%s\n' "$headers" | first_header "content-type")"

  echo "HTTP status: ${status_code:-unknown}"

  if [[ -n "$content_type_line" ]]; then
    echo "Content-Type: ${content_type_line#*: }" | sed 's/\r$//'
  fi

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
      echo "- Access app hostname/path must match: ${host} and ${path_prefix}/v1/* (or broader)."
      echo "- Enable 'Return 401 Response for Service Auth policies' to avoid redirects."
      echo "- Confirm policy changes are saved/published (no pending drafts)."
      exit 10
      ;;

    401)
      if printf '%s' "$content_type_line" | grep -qi 'text/html'; then
        echo "Result: denied by Cloudflare Access (HTML error page)."
      elif printf '%s' "$content_type_line" | grep -qi 'application/json'; then
        echo "Result: reached API Worker but request is unauthorized (JSON response)."
      else
        echo "Result: unauthorized (unknown upstream)."
      fi
      exit 11
      ;;

    530)
      # Often indicates Cloudflare edge could not reach origin / route for an allowed request.
      # For Access-protected hostnames this frequently surfaces as 1033.
      local body_file
      body_file="$(curl_get_body_auth_tmp "$API_URL" || true)"
      if [[ -n "${body_file:-}" && -f "$body_file" ]]; then
        if grep -q 'error code: 1033' "$body_file" 2>/dev/null; then
          echo "Result: Cloudflare edge error 1033 (route/origin unreachable)."
          echo "Most common causes:"
          echo "- Missing DNS record for ${host} (must exist and be proxied)"
          echo "- Worker route/custom domain not attached to the Worker"
          echo "- Leftover Tunnel/origin config expecting a tunnel-backed origin"
        else
          echo "Result: Cloudflare edge error (530)."
        fi
        rm -f "$body_file" >/dev/null 2>&1 || true
      else
        echo "Result: Cloudflare edge error (530)."
      fi
      exit 14
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
