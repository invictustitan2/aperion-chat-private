#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift

cd "$repo_root"

# Preserve current Private behavior:
# - Prefer verify-full.sh if present
# - Else fall back to the same pnpm steps the previous ./dev shim used

if [[ -x "./verify-full.sh" ]]; then
  exec ./verify-full.sh "$@"
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm -r --if-present lint
  pnpm -r --if-present typecheck
  pnpm test
  pnpm -r --if-present build
  exit 0
fi

echo "verify: no verify-full.sh and pnpm not found" >&2
exit 1
