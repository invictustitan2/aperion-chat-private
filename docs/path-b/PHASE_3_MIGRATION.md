# Path B — Phase 3 Migration & Rollback Plan: Same-Origin `/api` Mount

Status: Rollout plan. Phase 4 implementation has landed in repo; production behavior changes occur only when you deploy/configure Cloudflare as described below.

This plan depends on Phase 2 design decisions in `docs/path-b/PHASE_2_DESIGN.md`.

---

## Objectives

- Safely introduce `https://chat.aperion.cc/api/*` routed to the existing API Worker.
- Update the Worker to support `/api` prefix without breaking existing `/v1/*` routes.
- Update the web app to use same-origin `/api` in production.
- Preserve `https://api.aperion.cc/*` as a backward-compatible surface.

---

## Preconditions

- You have working Cloudflare credentials configured (no secrets printed by tooling).
- You can run devshell commands.

Recommended readiness checks:

- `./dev cf:doctor`
- `./dev cf:access:audit`

---

## Rollout Steps (Proposed)

## Manual Gate — Cloudflare Access UI (required)

Reality check: Cloudflare Zero Trust Access API automation is currently blocked for the Chat UI application (`Aperion Chat (UI)`), returning `code=12130 access.api.error.invalid_request` when attempting to enable the “Return 401…” toggle or create a Service Auth policy.

Treat this as a deliberate _manual gate_ with receipts.

- Use the operator checklist template:
  - [receipts/templates/MANUAL_CLOUDFLARE_ACCESS_PATH_B_CHECKLIST.md](../../receipts/templates/MANUAL_CLOUDFLARE_ACCESS_PATH_B_CHECKLIST.md)

Canonical post-change proof step (captures REST + WS evidence for the chosen surface):

- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser`

## Phase 3 Acceptance Criteria (no ambiguity)

Phase 3 is considered **COMPLETE** only when the REST + WS acceptance criteria below are satisfied.

### A) REST acceptance (same-origin, no CORS)

- Browser surface (Path B): same-origin requests under `https://chat.aperion.cc/api/v1/*`.
  - The web app must use `/api` (relative) in production (no cross-origin base such as `https://api.aperion.cc`).
- API surface (backward-compatible): `https://api.aperion.cc/v1/*` remains supported.

Canonical commands:

- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface api`

### B) WS acceptance (two-part proof)

WS acceptance is **two-part** and both parts are required:

1. Upgrade proof (machine):

- `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface <api|browser>`
- Expected (service token case):
  - `with_service_token.upgrade.http_status: 101`

2. Data-plane proof (headless, server-compatible):

- `RUN_NETWORK_TESTS=1 ./dev ws:proof --surface <api|browser> --mode headless`
- Expected:
  - `CONNECTED: yes`
  - Receipt contains `pong_received: true`

Notes:

- `ws:proof --mode headless` is the canonical Phase 3 proof because it is deterministic and does not rely on GUI/interactive Access login.
- Node WebSocket smoke (`scripts/smoke-ws.mjs`) close code `1006` is **diagnostic-only** and is **not** used for acceptance when `ws:probe` + headless `ws:proof` are green.

### Step 0 — Baseline receipts (before changes)

- Confirm current production behavior is healthy:
  - `RUN_NETWORK_TESTS=1 ./dev access:probe` (should show expected status patterns)
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke` (current surface)

Capture outputs as receipts if desired.

### Step 1 — Configure Cloudflare routing for `chat.aperion.cc/api/*`

- Add a Worker route so that requests to `chat.aperion.cc/api/*` are served by the existing Worker.

Repo status: `apps/api-worker/wrangler.toml` already contains a `routes` entry for `chat.aperion.cc/api/*`, but it only takes effect after a Worker deploy.

Validation (read-only / inventory):

- Confirm Access apps/policies plausibly cover `/api/v1/*`:
  - `./dev cf:access:audit --surface browser`

Note: If this audit indicates path mismatch, update the Access app path allow-list to include `/api/v1/*` (or equivalent), keeping the existing `/v1/*` coverage intact.

### Step 2 — Deploy Worker support for `/api` prefix

- Implement Worker path normalization as defined in Phase 2:
  - Strip `/api` prefix only for the Path B mount (`/api/v1/*` and `/api/v1/ws`) before itty-router matching.
  - Normalize metrics/logging paths to avoid double-counting.

Repo status: the conditional rewrite is implemented in `apps/api-worker/src/app.ts`. Deploy is still required.

Deploy:

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy --env production`

(Exact deploy command/env depends on your existing Wrangler environment and deploy wrappers.)

Validation (network):

- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke --surface browser`

Expected results:

- `GET https://chat.aperion.cc/api/v1/identity` behaves like the current identity endpoint under browser auth.
- WebSocket path is reachable at `wss://chat.aperion.cc/api/v1/ws` (end-to-end web validation comes after web deploy).

### Step 3 — Deploy web configured for same-origin `/api`

- Update web production configuration so the browser uses `/api` as its API base.
- Deploy Pages.

Repo status: the web app supports a relative `/api` base; production should use `/api` (same-origin) to avoid CORS.

Validation:

- In the browser, the app should call `/api/v1/*` without cross-origin requests.
- WebSocket should connect under `/api/v1/ws`.

### Step 4 — Monitor

- Confirm no unexpected error spikes.
- Confirm metrics paths remain stable (normalized).
- Confirm `api.aperion.cc` endpoints are still healthy.

---

## Backward Compatibility Guarantees

- `https://api.aperion.cc/v1/*` remains supported.
- Any non-browser clients, scripts, and tools may continue to use the old base URL.

---

## Rollback Plan

Rollback should be safe and fast.

### Rollback A — Web-only rollback

If the browser experience is broken but the Worker is healthy:

- Redeploy the web app with `VITE_API_BASE_URL=https://api.aperion.cc` (or prior known-good).

This restores cross-origin browser calls (CORS returns as a problem class, but availability is prioritized).

### Rollback B — Remove `chat.aperion.cc/api/*` routing

If routing precedence causes Pages/Worker conflicts or unexpected behavior:

- Remove/disable the Worker route for `chat.aperion.cc/api/*`.
- Keep `api.aperion.cc` route intact.

### Rollback C — Worker code rollback

If the `/api` prefix normalization causes regressions:

- Revert Worker to the previous version.
- Keep routing changes if they are harmless, or remove them if necessary.

---

## Verification Checklist (post-rollout)

- Browser (interactive):
  - `GET https://chat.aperion.cc/api/v1/identity` returns `200` with Access session.
  - WebSocket connects to `wss://chat.aperion.cc/api/v1/ws`.
- Backward compatibility:
  - `GET https://api.aperion.cc/v1/identity` continues to work.

---

## Notes

- All devshell network actions remain opt-in via `RUN_NETWORK_TESTS=1`.
- When auditing Access for Path B, use `./dev cf:access:audit --surface browser` to evaluate whether app paths plausibly cover `/api/v1/*`.
