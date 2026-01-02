#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# test:unit
#
# Runs Vitest (workspace) and produces a receipt.

devshell_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'ERROR: missing required command: %s\n' "$1" >&2
    exit 2
  }
}

devshell_require_cmd pnpm

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
receipt_dir="${repo_root}/receipts/test-unit.${timestamp_compact}"
latest_dir="${repo_root}/receipts/test-unit.latest"

mkdir -p "$receipt_dir" >/dev/null 2>&1 || true

set +e
pnpm test "$@" |& tee "${receipt_dir}/run.txt"
exit_code=$?
set -e

{
  printf 'TEST.UNIT.UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'TEST.UNIT.EXIT_CODE: %s\n' "$exit_code"
} >"${receipt_dir}/SUMMARY.txt"

rm -rf "$latest_dir" >/dev/null 2>&1 || true
cp -R "$receipt_dir" "$latest_dir"

printf 'RECEIPT_DIR: %s\n' "${receipt_dir#${repo_root}/}" >&2
printf 'RECEIPT_LATEST: %s\n' "${latest_dir#${repo_root}/}" >&2

exit "$exit_code"
