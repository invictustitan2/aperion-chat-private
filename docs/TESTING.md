# Testing

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev + Operator
> \
> **Canonical for:** How to run tests (unit + E2E) via `./dev`

## Philosophy

- Prefer running tests through `./dev` to get receipts and consistent safety rails.
- Networked tests are opt-in (`RUN_NETWORK_TESTS=1`).
- Production E2E is read-only and requires an authenticated Playwright `storageState` file (never commit it).
- The CI-grade verification gate includes a dependency vulnerability audit; treat known advisories as release blockers.

Dependency audit:

- Local receipts: `RUN_NETWORK_TESTS=1 ./dev deps:audit`
- CI gate: `./dev verify:ci` (runs `pnpm deps:audit`)

## Testing + coverage philosophy (detailed)

This repository uses test automation for two primary outcomes:

1. **Fast, trustworthy feedback while developing.**
2. **Auditable evidence for CI/prod safety checks** (via receipts).

This section is the “why” behind the test + coverage setup.

### Receipts-first, evidence always

- Prefer `./dev …` commands because they capture **receipts** (`receipts/<command>.<timestamp>/` + `*.latest/`) with logs and artifacts.
- Treat the receipt as the canonical artifact in CI and debugging.
- When reporting coverage, always point at a receipt snapshot (not a local `coverage/` folder that can be overwritten).

### Offline-safe by default

- Unit and coverage tests should run without network access.
- Networked tests must be explicitly enabled (`RUN_NETWORK_TESTS=1`) so CI and local runs stay deterministic.

### Test portfolio: pyramid-shaped

Follow a “test pyramid” posture:

- **Many** fast, deterministic unit/service tests.
- **Some** integration tests at important boundaries (serialization, persistence, queues, auth gates).
- **Few** end-to-end tests (local + prod smoke), focused only on core user journeys.

This keeps the suite fast and avoids the “flaky E2E wall”.

### Coverage is a safety net, not a trophy

- Coverage is used as a **regression guard** and a prioritization signal.
- We avoid “coverage theater” (trivial tests that assert little) and avoid driving to 100%.
- Tests should be written so they would **fail if the behavior breaks** (avoid false positives).

### Review culture: tests are part of code health

- Reviewers should ask for appropriate tests when behavior changes.
- Tests should be capable of failing for the right reason (avoid “always green” assertions that don’t prove behavior).
- Prefer tests that exercise meaningful branches (auth gates, error shaping, fallbacks) over shallow line execution.

### Thresholds are a floor and a ratchet

- The repo enforces a universal minimum threshold (**≥70%** for lines/statements/branches/functions).
- Thresholds should only move upward over time.
- If you want to raise standards, raise them incrementally and record a new baseline receipt.

### Suite-scoped coverage keeps numbers meaningful

Coverage is run as two suites with separate configs:

- **Node suite:** Worker + shared packages + tools.
- **Web suite (jsdom):** `apps/web` only.

This avoids distorting totals (e.g. web tests “failing” to cover worker-only code).

### Branch coverage is the quality lever

In this codebase, “branches” tends to track real behavior coverage better than lines:

- auth/permission gates
- error/fallback paths
- integration failure handling (D1/DO/AI bindings)
- parsing/validation branches

When lifting real coverage, prefer adding tests that exercise these paths rather than adding more files or widening exclusions.

### Mocking rule: mock the boundary, not your logic

- Mock external systems and runtime-only APIs (Durable Object runtime, Cloudflare bindings, `fetch`, `crypto.subtle`, puppeteer, AI providers).
- Keep your own logic real: parsing, mapping, validation, clamping, error shaping, and routing.

This keeps tests stable and preserves confidence while still being runnable under Node.

## Unit tests

```bash
./dev test:unit
```

## Coverage

```bash
./dev test:coverage
```

Coverage output is written under `coverage/vitest/`.

### Receipts + artifacts

`./dev test:coverage` is receipt-first. It writes:

- [receipts/test-coverage.latest/SUMMARY.txt](../receipts/test-coverage.latest/SUMMARY.txt)
- [receipts/test-coverage.latest/run.txt](../receipts/test-coverage.latest/run.txt)
- A timestamped receipt directory under `receipts/test-coverage.<UTC>/`

Because node + web coverage runs happen sequentially, `coverage/vitest/` will be overwritten by the second run. The devshell coverage command snapshots both reports into the receipt:

- `coverage-node/` (node suite coverage report)
- `coverage-web/` (jsdom/web suite coverage report)

### Current baseline (2026-01-02)

From receipt `receipts/test-coverage.20260102-113837Z`:

- **Node suite total:** Lines/Statements **68.53%** (3488/5089), Branches **65.08%** (561/862), Functions **82.19%** (180/219)
- **Web suite total:** Lines/Statements **72.16%** (5383/7459), Branches **73.96%** (784/1060), Functions **67.32%** (239/355)

Both runs must meet the configured global thresholds (Lines/Statements/Branches/Functions must be **≥70%**). This baseline should pass for both node + web.

### Interpreting the totals (important)

Coverage runs use suite-scoped Vitest configs to keep totals meaningful:

- Node coverage config: `vitest.coverage.node.config.ts`
  - `coverage.include`: `apps/api-worker/src/**`, `packages/**/src/**`, `tools/**/src/**`
  - Excludes running web tests under node.
- Web coverage config: `vitest.coverage.web.config.ts`
  - `coverage.include`: `apps/web/src/**`

For artifacts, use the receipt snapshot `coverage-summary.json` under `coverage-node/` and `coverage-web/`.

The receipt `SUMMARY.txt` also includes a one-line per-suite total (`COVERAGE_NODE_TOTAL`, `COVERAGE_WEB_TOTAL`) extracted from those snapshots.

It also includes:

- `COVERAGE_*_CRITICAL_TOTAL` rollups for “critical path” areas (worker entrypoints + middleware; web pages + web lib)
- `COVERAGE_*_TOP_UNCOVERED_*` lines listing the current top uncovered files by uncovered line count

### Largest gaps (quick pointers)

From the current baseline, the biggest low-coverage buckets are:

- **API worker (node suite):** service modules with minimal direct unit tests (e.g. `ConversationsService`, `IdentityService`, `InsightsService`, `KnowledgeService`)
- **Web (jsdom suite):** long-lived runtime modules that are hard to exercise in jsdom (e.g. websocket + app bootstrapping)

## Local E2E

Runs Playwright against local Vite (`http://localhost:5173`) and saves artifacts to receipts.

```bash
./dev e2e:local
```

## Production E2E (safe)

### 1) Create auth state (interactive)

This writes a cookie-based session file under `.ref/` (gitignored).

```bash
./dev e2e:auth:save:prod .ref/playwright/storageState.chat.prod.json
```

### 2) Run prod smoke suite

```bash
RUN_NETWORK_TESTS=1 \
PLAYWRIGHT_STORAGE_STATE=.ref/playwright/storageState.chat.prod.json \
./dev e2e:prod
```

## E2E best practices

- Prefer user-visible assertions (`getByRole`, `getByLabel`, `getByPlaceholder`) over brittle selectors.
- Use `data-testid` only for elements without stable accessible labels (and treat them as a contract).
- Keep prod smoke tests read-only: no message sends, deletes, renames, or other mutations.
- Always capture artifacts for failures; Playwright is configured to retain trace/video/screenshot on failure.
- If you must target a non-local URL in E2E, require `RUN_NETWORK_TESTS=1` (default posture is offline-safe).

## Receipts

Each command writes a timestamped folder under `receipts/` and maintains a `*.latest` copy for quick access.
