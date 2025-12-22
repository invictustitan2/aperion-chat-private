#!/usr/bin/env bash
set -euo pipefail

# Debug-only helper: diagnose whether Cloudflare Access is accepting a service token
# for the API application/hostname/path.
#
# Hard rules:
# - Never prints or writes token values.
# - Prints only: HTTP status line, Location header (if present), cf-ray header (if present).

URL="https://api.aperion.cc/v1/identity"

first_status_line() {
  awk 'NR==1 {print; exit}'
}

first_header() {
  # $1 = header name (case-insensitive, without trailing colon)
  local header_name="$1"
  grep -i -m 1 "^${header_name}:" || true
}

main() {
  local token_id token_secret

  read -r -p "CF Access Service Token Client ID: " token_id
  read -r -s -p "CF Access Service Token Client Secret (hidden): " token_secret
  echo

  if [ -z "$token_id" ] || [ -z "$token_secret" ]; then
    echo "ERROR: both Client ID and Client Secret are required." >&2
    exit 3
  fi

  # Capture headers only (no body) for stable parsing.
  local headers
  headers=$(curl -sS -D - -o /dev/null \
    -H "CF-Access-Client-Id: ${token_id}" \
    -H "CF-Access-Client-Secret: ${token_secret}" \
    "$URL")

  local status_line
  status_line=$(printf '%s\n' "$headers" | first_status_line)

  local location_line cf_ray_line
  location_line=$(printf '%s\n' "$headers" | first_header "location")
  cf_ray_line=$(printf '%s\n' "$headers" | first_header "cf-ray")

  printf '%s\n' "$status_line"
  if [ -n "$location_line" ]; then
    printf '%s\n' "$location_line"
  fi
  if [ -n "$cf_ray_line" ]; then
    printf '%s\n' "$cf_ray_line"
  fi

  if printf '%s' "$status_line" | grep -qE '\s200(\s|$)'; then
    exit 0
  fi
  if printf '%s' "$status_line" | grep -qE '\s302(\s|$)'; then
    exit 10
  fi
  if printf '%s' "$status_line" | grep -qE '\s403(\s|$)'; then
    exit 11
  fi
  exit 12
}

main "$@"
