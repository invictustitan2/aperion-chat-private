# Testing Roadmap (Coverage-Driven)

> **Status:** Legacy
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev
> \
> **Canonical for:** Historical planning snapshot only

This roadmap is a historical snapshot and is not maintained as current truth.

For current testing/verification gates, prefer:

- `docs/PROJECT_STATE.md`
- `docs/PROOF_REPORT.md`

This roadmap is intentionally coverage-driven and philosophy-aligned: we only test proven behavior, we keep failures noisy/actionable, and we treat each test as a “reason receipt” for why a behavior is trusted.

## Current Baseline (2025-12-17)

Command:

- Historical (at the time): `pnpm -w test:coverage` (Vitest v1.6.1)

Modern equivalent (preferred):

- `./dev test:coverage` (receipt-first; produces `receipts/test-coverage.latest/`)

Results:

- Tests: 246 passed
- Test Files: 54 passed

Coverage:

- Statements: 60.6% (7303/12050)
- Lines: 60.6% (7303/12050)
- Functions: 58.29% (239/410)
- Branches: 69.13% (746/1079)

Observed warnings / constraints (must be handled deterministically):

- Scheduled Workers are not automatically triggered in local dev.
- Workers AI bindings may hit remote resources (cost risk).
- Vectorize index doesn’t support local dev (needs mocking or `remote: true` strategy).
- `apps/api-worker/test/index.test.ts` is now active and passing (integration tests).
- `apps/api-worker/test/app.wiring.test.ts` covers composition root wiring (in-process).
- `apps/web/src/lib/api.test.ts` covers shared API client logic.

Runtime types (this PR):

- `apps/api-worker/worker-configuration.d.ts` is the source of truth for Worker runtime/binding types.
- Regenerate with: `pnpm --filter @aperion/api-worker types:generate`.
- Do not use `@cloudflare/workers-types` for new code; keep tests deterministic and local.

## Philosophy (Non-Negotiables)

- No placeholder features exposed to users.
- No flaky external calls in unit/integration tests.
- Relationships are first-class behaviors: any endpoint/UI that creates/updates relationships must have tests proving:
  - directionality (A → B; not symmetric unless explicitly so)
  - type safety (relationship type validated)
  - provenance preserved (e.g. traceId/request metadata captured)
- Every “semantic” behavior change includes a test + a short rationale (“receipt”) in the PR description.
- Failures must be noisy/actionable: clear assertion messages, no hidden retries masking real bugs.

## Coverage-Driven Workflow (Always Start Here)

1. Run: `./dev test:coverage`.
2. Identify the top 10 files by uncovered lines (non-optional).

   Extract top offenders automatically (no manual HTML clicking):

- Node suite: `node -e "const s=require('./receipts/test-coverage.latest/coverage-node/coverage-summary.json'); const files=Object.entries(s).filter(([k])=>k!=='total'); const rows=files.map(([file,v])=>({file, uncovered:(v.lines.total-v.lines.covered)})); rows.sort((a,b)=>b.uncovered-a.uncovered); console.log(rows.slice(0,10));"`
- Web suite: `node -e "const s=require('./receipts/test-coverage.latest/coverage-web/coverage-summary.json'); const files=Object.entries(s).filter(([k])=>k!=='total'); const rows=files.map(([file,v])=>({file, uncovered:(v.lines.total-v.lines.covered)})); rows.sort((a,b)=>b.uncovered-a.uncovered); console.log(rows.slice(0,10));"`

- Prefer the receipt `coverage-summary.json` snapshots for package-level hotspots.

Note: the full HTML report lives under `coverage/vitest/index.html` after running a single suite (ignored by git). The receipt snapshots intentionally stay lightweight.

3. Write tests that hit those files first (maximize executed lines per hour).
4. Re-run coverage and repeat until phase target is met.

## Coverage Targets (Phased, Concrete)

### Phase 1 (Fast Win): ~27% → 40% Lines/Statements

Goal: raise Lines and Statements to at least 40% by executing currently unexecuted composition roots (entrypoints, wiring, and shared utilities).

Why this works:

- Controllers already have coverage; the missing lines are mostly in composition and shared utilities (“glue code”).

Phase 1 focus (execute the dead code):

- API Worker entrypoint + composition root: `apps/api-worker/src/index.ts` (routing + middleware assembly).
- Middleware chain behavior (order matters): auth → context → error mapping; ensure it executes via request-driven tests.
- Service modules called by controllers (where real behavior lives): validate IO normalization, error translation, idempotency.
- Web composition roots: Chat page, Memory page, Conversations page, and major hooks/stores used by those pages.

Phase 1 requirement (skip burn-down):

- Reduce skipped tests from 8 → ≤2. Any remaining skip must be tied to a binding limitation with a documented mock plan.

Phase 1 done means (measurable):

- `apps/api-worker/src/index.ts` reaches ≥80% lines (composition root must be trustworthy).
- The “top 10 uncovered files” list changes materially (at least 5 of the original top 10 are no longer in the top 10).

Preferred test types (maximize executed lines):

- API Worker: request-driven integration tests (Miniflare/Wrangler-style) that exercise end-to-end routing through middleware → controller → service boundary (with mocks at binding edges).
- Web: React Testing Library tests that render pages and assert user-visible state transitions (loading/error/success), not implementation details.

### Phase 2: 40% → 60% Lines/Statements (Completed)

Goal: increase coverage while adding stronger behavioral guarantees for core flows.

- Expand worker integration tests to cover:
  - auth edge-cases (headers, schemes, token parsing)
  - idempotency/uniqueness behavior
  - error shapes and status codes
- Expand web tests to cover:
  - Memory: semantic search + result expansion behaviors
  - Relationships UI: list/create behaviors with deterministic API mocking
  - chat send flow error handling (no remote calls)

### Phase 3: 60% → 80%+ on Critical Paths

Goal: 80%+ Lines/Statements on critical paths (not necessarily the entire repo).

- Define “critical paths” explicitly (API routes + UI flows that ship value) and prioritize them.
- Add regression tests for the top 10 historical bug patterns (each test ties to a prior incident or a clearly described risk).

## Unskip & Rewrite: `apps/api-worker/test/index.test.ts`

This file must be unskipped and rewritten as deterministic wiring verification (no placeholders):

- Route registration: verifies expected endpoints exist and return expected status codes.
- Handler wiring: verifies middleware stack behavior (auth, context/logging, error handling) using real requests.
- Health/system endpoints: verifies health endpoint(s) return stable shapes and do not depend on remote bindings.

Acceptance criteria:

- Deterministic assertions (no remote calls, no time-dependent flakes).
- Middleware order is verified:
  - unauthenticated requests fail before controller execution
  - context middleware attaches traceId/logger even on errors
  - error mapping returns a stable shape (e.g. `{ error, code? }`) with correct status
- Asserts observable behavior only (status codes, JSON shapes, headers), not internal implementation.

## Binding Strategy for Deterministic Tests (No Remote Charges)

Default rule: tests must not trigger paid/remote resources.

Binding seam (single source of truth; no ad-hoc mocks):

- Create one test harness module, e.g. `apps/api-worker/test/bindings/mockBindings.ts`, that provides:
  - Fake AI (STT/TTS/chat) returning deterministic payloads
  - Fake Vectorize client returning fixed vectors / search hits
  - Fake Queues capturing enqueued messages in-memory
- All worker tests import bindings from that module so behavior stays consistent across suites.

- Workers AI bindings
  - Provide a default mock/stub implementation in unit/integration tests.
  - Tests should assert behavior around request/response handling, not model output quality.
- Vectorize
  - Prefer local mocks/stubs that return fixed vectors/results.
  - If `remote: true` is required for any test environment, call out cost risk explicitly and ensure CI defaults to mocks.

Guardrails:

- CI must fail if any test attempts to reach external network endpoints.
- Mocks must be the default; “remote mode” is an explicit opt-in for local debugging only.

No-network enforcement mechanism (make the guardrail real):

- Add a Vitest setup file (e.g. `vitest.setup.ts`) that blocks outbound `fetch` by default.
- Example (Node 18+/20+):

  ```ts
  // vitest.setup.ts
  const allowedHosts = new Set(["127.0.0.1", "localhost"]);

  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function") {
    globalThis.fetch = async (input: any, init?: any) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      if (!allowedHosts.has(url.hostname)) {
        throw new Error(`Blocked outbound fetch in tests: ${url.toString()}`);
      }
      return originalFetch(input, init);
    };
  }
  ```

- If using `undici` directly, use an equivalent dispatcher-based block.

## CI Coverage Gates

Use two gates so cleanup work can merge without freezing the repo:

- Gate A (immediate, non-regression): coverage must not drop below the current baseline (27.24% Lines/Statements).
- Gate B (ratchet): after Phase 1 merges, bump to 35%, then 40%; later bump to 60% and critical-path 80%+.

Stability requirements:

- No flaky external calls; mocks are mandatory.
- Any skipped test file requires an explicit issue/justification and a plan to unskip.

## Next 10 Tasks (Checklist)

- [x] Run `./dev test:coverage` and extract the top 10 uncovered files (paste output into the PR):
  - Node suite: `node -e "const s=require('./receipts/test-coverage.latest/coverage-node/coverage-summary.json'); const files=Object.entries(s).filter(([k])=>k!=='total'); const rows=files.map(([file,v])=>({file, uncovered:(v.lines.total-v.lines.covered)})); rows.sort((a,b)=>b.uncovered-a.uncovered); console.log(rows.slice(0,10));"`
  - Web suite: `node -e "const s=require('./receipts/test-coverage.latest/coverage-web/coverage-summary.json'); const files=Object.entries(s).filter(([k])=>k!=='total'); const rows=files.map(([file,v])=>({file, uncovered:(v.lines.total-v.lines.covered)})); rows.sort((a,b)=>b.uncovered-a.uncovered); console.log(rows.slice(0,10));"`
- [x] Create the binding seam module `apps/api-worker/test/bindings/mockBindings.ts` (Fake AI, Fake Vectorize, Fake Queues).
- [x] Refactor worker integration tests to import bindings from the seam (no ad-hoc mocks).
- [x] Unskip + rewrite `apps/api-worker/test/index.test.ts` to verify wiring + middleware order + stable error shapes.
- [x] Add request-driven tests that execute `apps/api-worker/src/index.ts` composition (routing + middleware assembly) through real HTTP requests.
- [x] Add React Testing Library tests for `Memory` page core flows (search → expand → empty/error states).
- [x] Add React Testing Library tests for `Chat` page core flows (render → send error handling; deterministic).
- [x] Add React Testing Library tests for Conversations page/list + key hooks/stores used by these pages.
- [x] Add tests for Relationships UI behaviors (list/create) with deterministic API mocking.
- [x] Add a “no-network” Vitest setup (block outbound `fetch`).
- [x] Migrate API Worker typing from `@cloudflare/workers-types` to Wrangler runtime types (`worker-configuration.d.ts`).
- [x] Implement CI Gate A (non-regression at 40% Lines/Statements); define the ratchet plan to 60% after Phase 2 merges.
- [x] Add tests for `CommandPalette` (top offender).
- [x] Add tests for `Identity` page (top offender).
- [x] Add tests for `Settings` page (top offender).
- [x] Add tests for `Logs` page (top offender).
- [x] Expand `Chat` page tests to cover error handling and edge cases.
- [x] Expand `api.ts` tests to cover all methods and error states.
- [x] Add tests for `ReceiptsController` (backend coverage).
- [x] Add tests for `LogsController` (backend coverage).
- [x] Add tests for `RunbooksController` (backend coverage).
- [x] Add tests for `MediaController` (backend coverage).
- [x] Add tests for `JobsController` (backend coverage).
- [x] Add tests for `cors`, `errorHandler`, and `rateLimit` middleware.

## Pre-PR Verification Checklist (Required for This PR)

- Types are regenerated and stable: `pnpm --filter @aperion/api-worker types:generate` (no unexpected diffs).
- Workspace checks are green: `pnpm -w typecheck`, `pnpm -w lint`, `./dev test:coverage`.
- Local Worker boots under test env: `pnpm --filter @aperion/api-worker wrangler dev --local --env test --port 8787`.
- Smoke requests confirm routing/auth/error-shapes (no remote calls; stable status codes/JSON):
  - `curl -i http://127.0.0.1:8787/v1/receipts`
  - `curl -i -H 'Authorization: Bearer test-secure-token-12345' http://127.0.0.1:8787/v1/receipts`
  - `curl -i -H 'Authorization: Bearer test-secure-token-12345' http://127.0.0.1:8787/v1/relationships`
