#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# ws:proof
#
# Browser-engine WS proof (Playwright headed Chromium).
#
# Hard rules:
# - Never print secrets.
# - Network must be opt-in via RUN_NETWORK_TESTS=1.
# - This is interactive: operator completes Cloudflare Access login.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
# shellcheck source=devshell/lib/surfaces.sh
source "${repo_root}/devshell/lib/surfaces.sh"

surface="api"
mode="${APERION_WS_PROOF_MODE:-interactive}"
base_url_override=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --surface)
      surface="${2:-}"
      shift 2
      ;;
    --mode)
      mode="${2:-}"
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

if [[ "$mode" != "interactive" && "$mode" != "headless" ]]; then
  devshell_die "invalid --mode (expected interactive|headless): $mode"
fi

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
  exit 3
fi

BASE_URL="$(devshell_api_base_url_resolve "$surface" "$base_url_override")"

# Convert https:// -> wss:// and http:// -> ws://.
WS_BASE="${BASE_URL/http:\/\//ws://}"
WS_BASE="${WS_BASE/https:\/\//wss://}"

WS_URL="${WS_BASE}/v1/ws"
AUTH_CHECK_URL="${BASE_URL}/v1/identity"

export SURFACE="$surface"
export WS_URL
export AUTH_CHECK_URL

if [[ "$mode" == 'headless' ]]; then
  # Headless proof uses service-token headers (no browser cookies, no GUI).
  if [[ -z "${CF_ACCESS_SERVICE_TOKEN_ID:-}" || -z "${CF_ACCESS_SERVICE_TOKEN_SECRET:-}" ]]; then
    printf '%s\n' 'BLOCKED: ws:proof --mode headless requires CF_ACCESS_SERVICE_TOKEN_ID and CF_ACCESS_SERVICE_TOKEN_SECRET in env.'
    printf '%s\n' 'Remediation: source ~/.config/aperion/cf_access.env (or set them in your shell) and retry.'
    exit 2
  fi

  export APERION_WS_PROOF_MODE='headless'
  node "${repo_root}/scripts/ws-proof.headless.mjs"
  exit $?
fi

if [[ "$surface" == 'browser' ]]; then
  printf '%s\n' 'INFO: Complete Access login in the opened browser window; script will continue automatically.'
fi

# Headed Playwright requires a display (X11/Wayland). In headless shells/CI, fail fast with a clear
# remediation instead of letting Playwright emit a long stack trace.
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  printf '%s\n' 'BLOCKED: ws:proof requires a GUI display (X11/Wayland); no $DISPLAY/$WAYLAND_DISPLAY is set.'
  printf '%s\n' 'Remediation: run this command from a machine with a desktop session, or use X11 forwarding (e.g. ssh -X), then retry.'
  printf '%s\n' 'Note: xvfb-run can provide a virtual display, but this proof is intended to be interactive (operator completes Access login).'
  exit 2
fi

node "${repo_root}/scripts/ws-proof.playwright.mjs"
