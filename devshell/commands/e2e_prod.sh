#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# e2e:prod
#
# Runs a production-safe Playwright smoke pack against chat.aperion.cc.
#
# Hard rules:
# - Network must be opt-in (RUN_NETWORK_TESTS=1).
# - Must use a Playwright storageState file (cookie-based Access session).
# - Must be read-only: no message sends, no mutation actions.

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable production E2E.'
  exit 3
fi

storage_state="${PLAYWRIGHT_STORAGE_STATE:-}"
if [[ -z "$storage_state" ]]; then
  printf '%s\n' 'ERROR: PLAYWRIGHT_STORAGE_STATE is required for prod E2E.' >&2
  printf '%s\n' 'Fix: create one via:' >&2
  printf '%s\n' '  ./dev e2e:auth:save:prod .ref/playwright/storageState.chat.prod.json' >&2
  printf '%s\n' '  PLAYWRIGHT_STORAGE_STATE=.ref/playwright/storageState.chat.prod.json RUN_NETWORK_TESTS=1 ./dev e2e:prod' >&2
  exit 2
fi

if [[ ! -f "$storage_state" ]]; then
  printf 'ERROR: storageState file not found: %s\n' "$storage_state" >&2
  exit 2
fi

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
receipt_dir="${repo_root}/receipts/e2e-prod.${timestamp_compact}"
latest_dir="${repo_root}/receipts/e2e-prod.latest"

mkdir -p "$receipt_dir" >/dev/null 2>&1 || true

export PLAYWRIGHT_BASE_URL="https://chat.aperion.cc"
export PLAYWRIGHT_STORAGE_STATE="$storage_state"
export PLAYWRIGHT_REPORT_DIR="${receipt_dir}/playwright-report"
export PLAYWRIGHT_OUTPUT_DIR="${receipt_dir}/test-results"

set +e
pnpm --filter @aperion/web exec playwright test apps/web/test/e2e/prod_smoke.spec.ts "$@" |& tee "${receipt_dir}/run.txt"
exit_code=$?
set -e

{
  printf 'E2E.PROD.UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'E2E.PROD.EXIT_CODE: %s\n' "$exit_code"
  printf 'BASE_URL: %s\n' "$PLAYWRIGHT_BASE_URL"
  printf 'STORAGE_STATE: %s\n' "$PLAYWRIGHT_STORAGE_STATE"
  printf 'REPORT_DIR: %s\n' "${PLAYWRIGHT_REPORT_DIR#${repo_root}/}"
  printf 'OUTPUT_DIR: %s\n' "${PLAYWRIGHT_OUTPUT_DIR#${repo_root}/}"
} >"${receipt_dir}/SUMMARY.txt"

rm -rf "$latest_dir" >/dev/null 2>&1 || true
cp -R "$receipt_dir" "$latest_dir"

printf 'RECEIPT_DIR: %s\n' "${receipt_dir#${repo_root}/}" >&2
printf 'RECEIPT_LATEST: %s\n' "${latest_dir#${repo_root}/}" >&2

exit "$exit_code"
