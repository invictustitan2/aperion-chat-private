#!/usr/bin/env bash
set -euo pipefail

# devshell/lib/surfaces.sh
#
# Central place to define/resolve API "surfaces".
#
# Goal: prepare for Path B (same-origin /api mount) without changing defaults.
#
# Current defaults:
#   - API surface (external clients): https://api.aperion.cc
#   - Browser API surface (planned):  https://chat.aperion.cc/api

# shellcheck source=devshell/lib/common.sh
# (common.sh provides devshell_die)

DEV_SHELL_SURFACE_DEFAULT='api'

# External clients / current production surface.
devshell_api_base_url_default() {
  printf '%s' "${APERION_API_BASE_URL:-https://api.aperion.cc}"
}

# Browser-facing surface for Path B planning.
devshell_browser_api_base_url_default() {
  printf '%s' "${APERION_BROWSER_API_BASE_URL:-https://chat.aperion.cc/api}"
}

devshell__url_is_httpish() {
  local url="${1:-}"
  [[ -n "$url" ]] || return 1
  [[ "$url" == http://* || "$url" == https://* ]]
}

devshell_api_base_url_resolve() {
  local surface="${1:-$DEV_SHELL_SURFACE_DEFAULT}"
  local override_url="${2:-}"

  if [[ -n "$override_url" ]]; then
    devshell__url_is_httpish "$override_url" || devshell_die "invalid --base-url (must start with http:// or https://): $override_url"
    printf '%s' "$override_url"
    return 0
  fi

  case "$surface" in
  api | external)
    printf '%s' "$(devshell_api_base_url_default)"
    ;;
  browser | chat)
    printf '%s' "$(devshell_browser_api_base_url_default)"
    ;;
  *)
    devshell_die "invalid --surface: $surface (expected: api|browser)"
    ;;
  esac
}

# Returns:
# - host (no scheme, no path)
# - path prefix ("/" if none)
devshell_split_url_host_and_path_prefix() {
  local base_url="$1"

  devshell__url_is_httpish "$base_url" || devshell_die "invalid base url: $base_url"

  local rest host path
  rest="${base_url#http://}"
  rest="${rest#https://}"

  host="${rest%%/*}"
  if [[ "$rest" == */* ]]; then
    path="/${rest#*/}"
  else
    path="/"
  fi

  printf '%s\n' "$host" "$path"
}
