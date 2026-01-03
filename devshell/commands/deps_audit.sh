#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:?repo_root required}"
shift

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

devshell_require_cmd pnpm

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<'HELP'
Usage:
  ./dev deps:audit

Runs `pnpm audit` and writes receipts.

Behavior:
- By default, skips unless RUN_NETWORK_TESTS=1 (pnpm audit may require network).
- When enabled, writes a timestamped JSON receipt plus a *.latest.json copy.
- Fails (nonzero) if any vulnerabilities are reported.

Receipts:
  - receipts/deps-audit.<UTC>.json
  - receipts/deps-audit.latest.json
HELP
  exit 0
fi

mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true

timestamp_compact="$(date -u +%Y%m%d-%H%M%SZ)"
receipt_path="${repo_root}/receipts/deps-audit.${timestamp_compact}.json"
latest_path="${repo_root}/receipts/deps-audit.latest.json"

# Keep this consistent with other devshell commands: network is opt-in.
if [ "${RUN_NETWORK_TESTS:-}" != "1" ]; then
  cat >"${receipt_path}" <<JSON
{"skipped":true,"reason":"Set RUN_NETWORK_TESTS=1 to enable pnpm audit."}
JSON
  cp -f "${receipt_path}" "${latest_path}" || true
  printf 'DEPS.AUDIT.OK: skip\n'
  printf 'RECEIPT: %s\n' "receipts/deps-audit.${timestamp_compact}.json"
  printf 'RECEIPT_LATEST: %s\n' 'receipts/deps-audit.latest.json'
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable pnpm audit.'
  exit 0
fi

# Run audit and capture machine output for evidence.
set +e
pnpm -s audit --json >"${receipt_path}"
audit_status=$?
set -e

# Always update latest pointer for operator convenience.
cp -f "${receipt_path}" "${latest_path}" || true

# Summarize deterministically from the captured JSON.
RECEIPT_PATH="${receipt_path}" node <<'NODE'
const fs = require('fs');
const path = process.env.RECEIPT_PATH;
const raw = fs.readFileSync(path, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.log('DEPS.AUDIT.OK: no');
  console.log('DEPS.AUDIT.ERROR: invalid_json');
  console.log('DEPS.AUDIT.ERROR_MESSAGE: ' + String(e && e.message || e));
  process.exit(2);
}

const meta = data.metadata || {};
const counts = meta.vulnerabilities || meta.vulnerabilityCounts || {};
const advisories = data.advisories ? Object.values(data.advisories) : [];

const hasAny = Object.values(counts).some((n) => Number(n) > 0) || advisories.length > 0;
console.log('DEPS.AUDIT.OK: ' + (hasAny ? 'no' : 'yes'));
console.log('DEPS.AUDIT.VULNS.INFO: ' + Number(counts.info || 0));
console.log('DEPS.AUDIT.VULNS.LOW: ' + Number(counts.low || 0));
console.log('DEPS.AUDIT.VULNS.MODERATE: ' + Number(counts.moderate || 0));
console.log('DEPS.AUDIT.VULNS.HIGH: ' + Number(counts.high || 0));
console.log('DEPS.AUDIT.VULNS.CRITICAL: ' + Number(counts.critical || 0));
console.log('DEPS.AUDIT.ADVISORIES.COUNT: ' + advisories.length);

if (advisories.length) {
  for (const a of advisories) {
    const mod = a.module_name || a.name || 'unknown';
    const sev = a.severity || 'unknown';
    const title = a.title || 'unknown';
    const patched = a.patched_versions || 'unknown';
    console.log(`DEPS.AUDIT.ADVISORY: ${sev} ${mod} — ${title} (patched: ${patched})`);
  }
}

process.exit(hasAny ? 1 : 0);
NODE