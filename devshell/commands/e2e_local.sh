#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# e2e:local
#
# Runs Playwright E2E against a local web server (Vite) and produces receipts.
#
# Safety:
# - If PLAYWRIGHT_BASE_URL is set to a non-localhost URL, require RUN_NETWORK_TESTS=1.

base_url="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}"

if [[ "$base_url" != http://localhost:5173* && "$base_url" != http://127.0.0.1:5173* ]]; then
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'ERROR: refusing to run E2E against non-local base URL without RUN_NETWORK_TESTS=1.' >&2
    printf 'BASE_URL: %s\n' "$base_url" >&2
    exit 2
  fi
fi

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
receipt_dir="${repo_root}/receipts/e2e-local.${timestamp_compact}"
latest_dir="${repo_root}/receipts/e2e-local.latest"

mkdir -p "$receipt_dir" >/dev/null 2>&1 || true

export PLAYWRIGHT_BASE_URL="$base_url"
export PLAYWRIGHT_REPORT_DIR="${receipt_dir}/playwright-report"
export PLAYWRIGHT_OUTPUT_DIR="${receipt_dir}/test-results"

set +e
pnpm --filter @aperion/web exec playwright test "$@" |& tee "${receipt_dir}/run.txt"
exit_code=$?
set -e

{
  printf 'E2E.LOCAL.UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'E2E.LOCAL.EXIT_CODE: %s\n' "$exit_code"
  printf 'BASE_URL: %s\n' "$PLAYWRIGHT_BASE_URL"
  printf 'REPORT_DIR: %s\n' "${PLAYWRIGHT_REPORT_DIR#${repo_root}/}"
  printf 'OUTPUT_DIR: %s\n' "${PLAYWRIGHT_OUTPUT_DIR#${repo_root}/}"
} >"${receipt_dir}/SUMMARY.txt"

rm -rf "$latest_dir" >/dev/null 2>&1 || true
cp -R "$receipt_dir" "$latest_dir"

printf 'RECEIPT_DIR: %s\n' "${receipt_dir#${repo_root}/}" >&2
printf 'RECEIPT_LATEST: %s\n' "${latest_dir#${repo_root}/}" >&2

exit "$exit_code"
