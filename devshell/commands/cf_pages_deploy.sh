#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:pages:deploy
#
# Deploys Cloudflare Pages safely (build-var sanity + optional force).
#
# Hard rules:
# - Never print secrets.
# - Network must be opt-in (RUN_NETWORK_TESTS=1) because this hits Cloudflare.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

force='no'
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --force)
      force='yes'
      shift || true
      ;;
    *)
      printf 'ERROR: unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

# Load repo dotenv by default (safe parser). Allow tests/CI to disable.
if [[ "${DEV_LOAD_DOTENV:-1}" != "0" ]]; then
  devshell_load_repo_dotenv "$repo_root" || true
fi

vite_api_base_url="${VITE_API_BASE_URL:-}"
vite_auth_mode="${VITE_AUTH_MODE:-}"

printf 'PAGES.BUILD.VITE_API_BASE_URL: %s\n' "$vite_api_base_url"
printf 'PAGES.BUILD.VITE_AUTH_MODE: %s\n' "$vite_auth_mode"

expected_prod_base="${APERION_EXPECTED_VITE_API_BASE_URL:-https://api.aperion.cc}"

# Enforce prod safety guardrail unless explicitly forced.
if [[ -z "$vite_api_base_url" || "$vite_api_base_url" != "$expected_prod_base" ]]; then
  printf 'WARN: VITE_API_BASE_URL is not production (%s).\n' "$expected_prod_base" >&2
  if [[ "$force" != 'yes' ]]; then
    printf '%s\n' 'REFUSE: pass --force to proceed anyway.' >&2
    exit 2
  fi
fi

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable Cloudflare deploy.'
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: pnpm' >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: npx' >&2
  exit 1
fi

# Export Vite vars so the build is deterministic even if local dotenv differs.
export VITE_API_BASE_URL="$vite_api_base_url"
export VITE_AUTH_MODE="$vite_auth_mode"

pnpm -s -C apps/web build >/dev/null

set +e
pages_out="$(npx wrangler pages deploy apps/web/dist --project-name aperion-chat-private 2>&1)"
pages_status=$?
set -e

if [[ "$pages_status" -ne 0 ]]; then
  printf '%s\n' 'PAGES.DEPLOY.OK: no'
  err_line="$(printf '%s\n' "$pages_out" | grep -E -m 1 '(ERROR|Error|\[ERROR\]|✘)' || true)"
  if [[ -n "$err_line" ]]; then
    printf 'PAGES.DEPLOY.ERROR: %s\n' "$err_line"
  fi
  printf '%s\n' 'NEXT: re-run with raw wrangler for full logs:'
  printf '%s\n' '  cd apps/web && pnpm build && npx wrangler pages deploy dist --project-name aperion-chat-private'
  exit "$pages_status"
fi

printf '%s\n' 'PAGES.DEPLOY.OK: yes'

# Best-effort: extract the first pages.dev URL.
url="$(printf '%s\n' "$pages_out" | grep -Eo 'https://[^ ]+\.pages\.dev[^ ]*' | head -n 1 || true)"
if [[ -n "$url" ]]; then
  printf 'PAGES.DEPLOY.URL: %s\n' "$url"
fi
