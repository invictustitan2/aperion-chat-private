#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:?repo_root required}"
shift

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<'HELP'
Usage:
  ./dev verify:ci

CI-grade verification gate.

Behavior:
- Strict Cloudflare preflight via `./dev cf:doctor --json --fail-on-warn`
- Then runs the same repo-level verification and guards CI relies on:
  - pnpm verify
  - pnpm guard:prod-secrets
  - pnpm guard:config-drift

Notes:
- Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to be set in CI.
- Does not deploy or mutate Cloudflare resources.
HELP
  exit 0
fi

missing=()
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then missing+=("CLOUDFLARE_API_TOKEN"); fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then missing+=("CLOUDFLARE_ACCOUNT_ID"); fi

if [ "${#missing[@]}" -gt 0 ]; then
  printf 'ERROR: missing required CI Cloudflare env var(s): %s\n' "${missing[*]}" >&2
  printf '%s\n' "Remediation: set them in GitHub Actions (repo secrets or org/repo vars per policy)." >&2
  exit 2
fi

devshell_require_cmd pnpm

# Ensure local toolchain bins are available in CI shells.
# Append (not prepend) so test harnesses can override with PATH stubs.
if [ -d "${repo_root}/node_modules/.bin" ]; then
  case ":${PATH}:" in
    *":${repo_root}/node_modules/.bin:"*)
      ;;
    *)
      export PATH="${PATH}:${repo_root}/node_modules/.bin"
      ;;
  esac
fi

# Strict Cloudflare preflight (read-only).
"${repo_root}/dev" cf:doctor --json --fail-on-warn

# Match CI's verification/guards.
pnpm verify
pnpm guard:prod-secrets
pnpm guard:config-drift
