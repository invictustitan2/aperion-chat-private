#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# e2e:auth:save (prod)
#
# Interactive helper to create a Playwright storageState file for chat.aperion.cc.
# Uses Playwright codegen because it supports --save-storage.
#
# WARNING: storageState contains sensitive cookies. Keep it under .ref/ (gitignored).

out_path="${1:-.ref/playwright/storageState.chat.prod.json}"
if [[ $# -gt 0 ]]; then
	shift
fi

mkdir -p "$(dirname -- "$out_path")" >/dev/null 2>&1 || true

# Intentionally interactive.
export PLAYWRIGHT_BASE_URL="https://chat.aperion.cc"

printf '%s\n' "Opening browser to save storageState: $out_path" >&2
printf '%s\n' 'Log in via Cloudflare Access, then close the window to write storageState.' >&2

pnpm --filter @aperion/web exec playwright codegen "https://chat.aperion.cc" --save-storage "$out_path" "$@"

printf '%s\n' "Wrote: $out_path" >&2
