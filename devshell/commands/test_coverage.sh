#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# test:coverage
#
# Runs Vitest coverage and produces a receipt.

devshell_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'ERROR: missing required command: %s\n' "$1" >&2
    exit 2
  }
}

devshell_require_cmd pnpm
devshell_require_cmd node

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
receipt_dir="${repo_root}/receipts/test-coverage.${timestamp_compact}"
latest_dir="${repo_root}/receipts/test-coverage.latest"

mkdir -p "$receipt_dir" >/dev/null 2>&1 || true

# Preserve original stderr for a few human-readable status lines even when we
# redirect most output into the receipt logs.
exec 3>&2

# If stdout is not a TTY (e.g. CI log capture, tooling that truncates output),
# piping large test output to stdout can trigger SIGPIPE and abort the run.
# In non-interactive mode we still capture full logs to the receipt but we do
# not stream the entire test output.
if [ -t 1 ]; then
  exec > >(tee "${receipt_dir}/run.txt") 2>&1
else
  exec > >(tee "${receipt_dir}/run.txt" >/dev/null) 2>&1
fi

coverage_summary_line() {
  local label="$1"
  local summary_json="$2"

  if [ ! -f "$summary_json" ]; then
    printf '%s: (missing coverage-summary.json)\n' "$label"
    return 0
  fi

  node - <<'NODE' "$label" "$summary_json"
const [label, summaryPath] = process.argv.slice(2)
const fs = require('node:fs')

const raw = fs.readFileSync(summaryPath, 'utf8')
const json = JSON.parse(raw)
const t = json && json.total
if (!t) {
  console.log(`${label}: (invalid coverage-summary.json)`)
  process.exit(0)
}

function fmt(metric) {
  const pct = (metric?.pct ?? 0).toFixed(2)
  const covered = metric?.covered ?? 0
  const total = metric?.total ?? 0
  return { pct, covered, total }
}

const lines = fmt(t.lines)
const statements = fmt(t.statements)
const branches = fmt(t.branches)
const functions = fmt(t.functions)

console.log(
  `${label}: Lines ${lines.pct}% (${lines.covered}/${lines.total}), ` +
    `Statements ${statements.pct}% (${statements.covered}/${statements.total}), ` +
    `Branches ${branches.pct}% (${branches.covered}/${branches.total}), ` +
    `Functions ${functions.pct}% (${functions.covered}/${functions.total})`,
)
NODE
}

coverage_group_summary_line() {
  local label="$1"
  local summary_json="$2"
  local prefixes_csv="$3"
  local repo_root="$4"

  if [ ! -f "$summary_json" ]; then
    printf '%s: (missing coverage-summary.json)\n' "$label"
    return 0
  fi

  node - <<'NODE' "$label" "$summary_json" "$prefixes_csv" "$repo_root"
const [label, summaryPath, prefixesCsv, repoRoot] = process.argv.slice(2)
const fs = require('node:fs')
const path = require('node:path')

const prefixes = (prefixesCsv || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const raw = fs.readFileSync(summaryPath, 'utf8')
const json = JSON.parse(raw)

let totals = {
  lines: { total: 0, covered: 0 },
  statements: { total: 0, covered: 0 },
  branches: { total: 0, covered: 0 },
  functions: { total: 0, covered: 0 },
}

function matches(file) {
  if (!prefixes.length) return true
  return prefixes.some((p) => file === p || file.startsWith(p))
}

function normalize(file) {
  if (!repoRoot) return file
  const prefix = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep
  if (file.startsWith(prefix)) return file.slice(prefix.length)
  return file
}

for (const [rawFile, v] of Object.entries(json)) {
  if (rawFile === 'total') continue
  const file = normalize(rawFile)
  if (!matches(file)) continue

  for (const k of ['lines', 'statements', 'branches', 'functions']) {
    totals[k].total += v?.[k]?.total ?? 0
    totals[k].covered += v?.[k]?.covered ?? 0
  }
}

function pct(covered, total) {
  if (!total) return '0.00'
  return ((covered / total) * 100).toFixed(2)
}

console.log(
  `${label}: Lines ${pct(totals.lines.covered, totals.lines.total)}% (${totals.lines.covered}/${totals.lines.total}), ` +
    `Statements ${pct(totals.statements.covered, totals.statements.total)}% (${totals.statements.covered}/${totals.statements.total}), ` +
    `Branches ${pct(totals.branches.covered, totals.branches.total)}% (${totals.branches.covered}/${totals.branches.total}), ` +
    `Functions ${pct(totals.functions.covered, totals.functions.total)}% (${totals.functions.covered}/${totals.functions.total})`,
)
NODE
}

coverage_write_top_uncovered_lines() {
  local key_prefix="$1"
  local summary_json="$2"
  local limit="$3"
  local repo_root="$4"

  if [ ! -f "$summary_json" ]; then
    printf '%s_01: (missing coverage-summary.json)\n' "$key_prefix"
    return 0
  fi

  node - <<'NODE' "$key_prefix" "$summary_json" "$limit" "$repo_root"
const [keyPrefix, summaryPath, limitStr, repoRoot] = process.argv.slice(2)
const limit = Math.max(1, Number(limitStr || 10))
const fs = require('node:fs')
const path = require('node:path')

const raw = fs.readFileSync(summaryPath, 'utf8')
const json = JSON.parse(raw)

function normalize(file) {
  if (!repoRoot) return file
  const prefix = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep
  if (file.startsWith(prefix)) return file.slice(prefix.length)
  return file
}

const files = Object.entries(json)
  .filter(([k]) => k !== 'total')
  .map(([rawFile, v]) => {
    const file = normalize(rawFile)
    const lines = v?.lines ?? { total: 0, covered: 0, pct: 0 }
    const uncovered = (lines.total ?? 0) - (lines.covered ?? 0)
    return {
      file,
      uncovered,
      pct: Number(lines.pct ?? 0),
      covered: Number(lines.covered ?? 0),
      total: Number(lines.total ?? 0),
    }
  })
  .sort((a, b) => b.uncovered - a.uncovered)

for (let i = 0; i < Math.min(limit, files.length); i++) {
  const row = files[i]
  const idx = String(i + 1).padStart(2, '0')
  const pct = row.pct.toFixed(2)
  console.log(
    `${keyPrefix}_${idx}: ${row.file} (uncoveredLines=${row.uncovered}, lines=${pct}% ${row.covered}/${row.total})`,
  )
}
NODE
}

set +e
printf '=== COVERAGE:node (pnpm test:coverage:node) ===\n' >&3
pnpm test:coverage:node "$@"
node_exit_code=$?

snapshot_coverage() {
  local dest_dir="$1"
  local src_dir="${repo_root}/coverage/vitest"

  rm -rf "$dest_dir" >/dev/null 2>&1 || true
  mkdir -p "$dest_dir" >/dev/null 2>&1 || true

  # Keep receipts lightweight: snapshot only machine-readable artifacts.
  # The full HTML report is available locally under coverage/vitest/ (ignored by git).
  for f in coverage-summary.json lcov.info; do
    if [ -f "${src_dir}/${f}" ]; then
      cp "${src_dir}/${f}" "${dest_dir}/${f}"
    fi
  done
}

# Snapshot coverage output for evidence (the subsequent web run may overwrite it).
if [ -d "${repo_root}/coverage/vitest" ]; then
  snapshot_coverage "${receipt_dir}/coverage-node"
fi

printf '\n=== COVERAGE:web (pnpm test:coverage:web) ===\n' >&3
pnpm test:coverage:web "$@"
web_exit_code=$?

if [ -d "${repo_root}/coverage/vitest" ]; then
  snapshot_coverage "${receipt_dir}/coverage-web"
fi

if [ "$node_exit_code" -ne 0 ] || [ "$web_exit_code" -ne 0 ]; then
  exit_code=1
else
  exit_code=0
fi
set -e

{
  printf 'TEST.COVERAGE.UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'TEST.COVERAGE.EXIT_CODE: %s\n' "$exit_code"
  printf 'TEST.COVERAGE.NODE_EXIT_CODE: %s\n' "$node_exit_code"
  printf 'TEST.COVERAGE.WEB_EXIT_CODE: %s\n' "$web_exit_code"
  printf 'COVERAGE_DIR: %s\n' 'coverage/vitest'
  printf 'COVERAGE_NODE_SNAPSHOT_DIR: %s\n' "receipts/test-coverage.${timestamp_compact}/coverage-node"
  printf 'COVERAGE_WEB_SNAPSHOT_DIR: %s\n' "receipts/test-coverage.${timestamp_compact}/coverage-web"

  printf '\n'
  printf 'COVERAGE_NODE_TOTAL: %s\n' "$(coverage_summary_line 'node' "${receipt_dir}/coverage-node/coverage-summary.json")"
  printf 'COVERAGE_WEB_TOTAL: %s\n' "$(coverage_summary_line 'web' "${receipt_dir}/coverage-web/coverage-summary.json")"

  printf '\n'
  printf 'COVERAGE_NODE_CRITICAL_FILTER: %s\n' 'apps/api-worker/src/index.ts, apps/api-worker/src/app.ts, apps/api-worker/src/middleware/'
  printf 'COVERAGE_NODE_CRITICAL_TOTAL: %s\n' "$(coverage_group_summary_line 'node-critical' "${receipt_dir}/coverage-node/coverage-summary.json" 'apps/api-worker/src/index.ts,apps/api-worker/src/app.ts,apps/api-worker/src/middleware/' "$repo_root")"
  printf 'COVERAGE_WEB_CRITICAL_FILTER: %s\n' 'apps/web/src/pages/, apps/web/src/lib/'
  printf 'COVERAGE_WEB_CRITICAL_TOTAL: %s\n' "$(coverage_group_summary_line 'web-critical' "${receipt_dir}/coverage-web/coverage-summary.json" 'apps/web/src/pages/,apps/web/src/lib/' "$repo_root")"

  printf '\n'
  printf 'COVERAGE_NODE_TOP_UNCOVERED_LIMIT: %s\n' '10'
  coverage_write_top_uncovered_lines 'COVERAGE_NODE_TOP_UNCOVERED' "${receipt_dir}/coverage-node/coverage-summary.json" 10 "$repo_root"

  printf '\n'
  printf 'COVERAGE_WEB_TOP_UNCOVERED_LIMIT: %s\n' '10'
  coverage_write_top_uncovered_lines 'COVERAGE_WEB_TOP_UNCOVERED' "${receipt_dir}/coverage-web/coverage-summary.json" 10 "$repo_root"
} >"${receipt_dir}/SUMMARY.txt"

rm -rf "$latest_dir" >/dev/null 2>&1 || true
cp -R "$receipt_dir" "$latest_dir"

printf 'RECEIPT_DIR: %s\n' "${receipt_dir#${repo_root}/}" >&3
printf 'RECEIPT_LATEST: %s\n' "${latest_dir#${repo_root}/}" >&3

exit "$exit_code"
