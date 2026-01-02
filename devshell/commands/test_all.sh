#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# test:all
#
# Runs unit tests (Vitest) and local E2E (Playwright) and produces receipts.

"${repo_root}/dev" test:unit
"${repo_root}/dev" e2e:local
