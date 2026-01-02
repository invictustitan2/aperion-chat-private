# Docs Refactor Tracking (Project-Wide)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator (solo) + Dev
> \
> **Canonical for:** Tracking and sequencing the documentation refactor

## Goal

Bring _all_ documentation into alignment with **actual project state** (code/config/tests/receipts), so upgrades can proceed with a clear, non-contradictory path.

This file is the control plane for the docs refactor: what changes, in what order, and what “evidence” must be verified.

## Ground rules (non-negotiable)

- **Docs must match reality**: every operational claim should be backed by one of:
  - code (source of truth),
  - config (wrangler/workflows),
  - tests (drift traps),
  - receipts (operator evidence).
- **One canonical doc per topic**: everything else is **Partial** or **Legacy** and must point to the canonical replacement.
- **Statuses everywhere**: every doc gets a status header from `docs/DOC_STATUS_RUBRIC.md`.
- **No silent drift**: where possible, add/extend tests that enforce critical doc invariants.

## Current “Reality Anchors” (must not drift)

These are the invariants that many docs depend on.

- **Browser API contract (production):** same-origin under `/api`.
  - Evidence:
    - `apps/web/src/lib/apiBaseUrl.ts` (prod default `/api`)
    - `apps/api-worker/wrangler.toml` (route `chat.aperion.cc/api/*`)
    - `test/workflows_deploy_web_path_b.test.ts` (deploy-web must not set `https://api.aperion.cc`)
    - `test/docs_path_b_defaults.test.ts` (API docs must not instruct cross-origin browser base)
- **Tooling/back-compat surface remains:** `https://api.aperion.cc/v1/*`.
  - Evidence: `apps/api-worker/wrangler.toml` route `api.aperion.cc`
- **Auth posture:** Cloudflare Access in production (`APERION_AUTH_MODE=access`).
  - Evidence: `apps/api-worker/wrangler.toml` required vars comment list + `scripts/guard-config-drift.mjs`
- **Receipts-first ops:** networked devshell actions are opt-in via `RUN_NETWORK_TESTS=1`.
  - Evidence: `devshell/` commands + bats tests

## Workstreams (iteration order)

1. **Operator truth** (highest value)
   - Deploy/runbooks, Access, probes, incident playbooks, receipts.
2. **Dev onboarding + local dev**
   - bootstrap, devshell usage, local env, debugging.
3. **Architecture + system map**
   - components, data stores, policy/receipts model.
4. **Reference**
   - API reference, OpenAPI, selector contracts.
5. **Planning docs**
   - roadmaps, phase summaries (must be explicitly marked Planned/Legacy).

## Tracking table

Legend:

- **Action**: Keep | Rewrite | Merge-into | Split | Deprecate (Legacy + pointer) | Delete (only if truly redundant)
- **Target Status**: Full | Partial | Planned | Untested | Legacy

### Repo-root docs

| Area            | File                               | Target status | Action    | Canonical replacement                                    | Evidence to verify / update against                      |
| --------------- | ---------------------------------- | ------------: | --------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Entry point     | `README.md`                        |          Full | Keep      | n/a                                                      | Current contracts + canonical links                      |
| Deploy overview | `DEPLOYMENT.md`                    |        Legacy | Deprecate | `docs/DEPLOY_PROD_RUN.md`                                | Workflows, devshell deploy scripts, Pages/Worker configs |
| Auth history    | `AUTHENTICATION_IMPLEMENTATION.md` |        Legacy | Deprecate | `docs/authentication-setup.md` + `docs/PROJECT_STATE.md` | Ensure it clearly says “historical”                      |
| Security        | `SECURITY.md`                      |          Full | Keep      | n/a                                                      | Actual secret-handling + guardrails                      |

### Canonical docs (must be correct)

| Area           | File                        | Target status | Action | Canonical replacement | Evidence to verify / update against                                                      |
| -------------- | --------------------------- | ------------: | ------ | --------------------- | ---------------------------------------------------------------------------------------- |
| Docs entry     | `docs/INDEX.md`             |          Full | Keep   | n/a                   | Must link only to real canonical docs                                                    |
| Project truth  | `docs/PROJECT_STATE.md`     |          Full | Keep   | n/a                   | Must match code/config/tests                                                             |
| Deploy config  | `docs/DEPLOY_PROD.md`       |          Full | Keep   | n/a                   | `scripts/guard-config-drift.mjs`, `scripts/guard-prod-secrets.mjs`, web/worker auth code |
| Deploy runbook | `docs/DEPLOY_PROD_RUN.md`   |          Full | Keep   | n/a                   | Must match `./dev deploy:prod` + `./dev deploy:validate` + receipts                      |
| PWA bypass     | `docs/ACCESS_PWA_BYPASS.md` |          Full | Keep   | n/a                   | Must match `./dev pwa:probe` + Access UI reality                                         |
| Devshell       | `docs/devshell.md`          |          Full | Keep   | n/a                   | Must match actual commands in `./dev`                                                    |
| API ref        | `docs/API_REFERENCE.md`     |          Full | Keep   | n/a                   | Must match worker routes/controllers/schemas                                             |

### High-churn docs (need truth pass)

| Area              | File                           | Target status | Action    | Canonical replacement                                                        | Evidence to verify / update against                                |
| ----------------- | ------------------------------ | ------------: | --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Onboarding        | `docs/Onboarding.md`           |          Full | Keep      | n/a                                                                          | bootstrap scripts + current local dev flow                         |
| Auth setup        | `docs/authentication-setup.md` |          Full | Keep      | n/a                                                                          | worker auth middleware + Access vars + runbooks                    |
| Auth debugging    | `docs/auth-debugging.md`       |          Full | Keep      | n/a                                                                          | current failure modes (Access redirects, WS preflight, PWA bypass) |
| Cloudflare deploy | `docs/deploy-cloudflare.md`    |        Legacy | Deprecate | `docs/DEPLOY_PROD_RUN.md` + `docs/CLOUDFLARE_SURFACE.md`                     | workflows + wrangler configs                                       |
| Reality checks    | `docs/REALITY_CHECKS.md`       |        Legacy | Keep      | `docs/PROOF_REPORT.md` + `docs/DEPLOY_PROD_RUN.md` + `docs/PROJECT_STATE.md` | receipts + devshell probes                                         |

### Architecture / system docs

| Area                   | File                         | Target status | Action | Canonical replacement | Evidence to verify / update against                           |
| ---------------------- | ---------------------------- | ------------: | ------ | --------------------- | ------------------------------------------------------------- |
| Architecture           | `docs/architecture.md`       |          Full | Keep   | n/a                   | actual modules/bindings used (DO/D1/R2/Queues/Vectorize/etc.) |
| Policy                 | `docs/policy.md`             |          Full | Keep   | n/a                   | `packages/policy` + how receipts are emitted                  |
| Cloudflare surface map | `docs/CLOUDFLARE_SURFACE.md` |          Full | Keep   | n/a                   | `wrangler.toml` + workflows                                   |

### Reference / contracts

| Area          | File                            | Target status | Action | Canonical replacement | Evidence to verify / update against |
| ------------- | ------------------------------- | ------------: | ------ | --------------------- | ----------------------------------- |
| E2E selectors | `docs/E2E_SELECTOR_CONTRACT.md` |          Full | Keep   | n/a                   | Playwright tests/selectors          |
| OpenAPI       | `docs/openapi.json`             |       Partial | Keep   | n/a                   | regenerate script + worker routes   |

### Planning docs (must be clearly labeled)

All phase summaries/roadmaps must be explicitly **Planned** or **Legacy** and must not be written in a way that sounds like it is already shipped.

| Area               |                                                     File/glob | Target status       | Action                       |
| ------------------ | ------------------------------------------------------------: | ------------------- | ---------------------------- |
| Roadmaps/summaries | `docs/ROADMAP_*.md`, `docs/PHASE_*_*.md`, `docs/*ROADMAP*.md` | Planned (or Legacy) | Deprecate or Rewrite headers |

### Legacy: Path B phase docs

These should remain for archaeology but must not be referenced as “source of truth” for current operation.

| Area   |       File/glob | Target status | Action                         | Canonical replacement                               |
| ------ | --------------: | ------------- | ------------------------------ | --------------------------------------------------- |
| Path B | `docs/path-b/*` | Legacy        | Deprecate (headers + pointers) | `docs/PROJECT_STATE.md` + `docs/DEPLOY_PROD_RUN.md` |

## Immediate next iteration (proposed)

Iteration 1 (operator-facing):

- Make `docs/DEPLOY_PROD_RUN.md` + `docs/PROJECT_STATE.md` the only canonical sources for “what is production”.
- Update `docs/REALITY_CHECKS.md` to reflect the actual current probes and receipt locations.

Iteration 2 (dev-facing):

- Rewrite `docs/Onboarding.md` around `./scripts/bootstrap-dev.sh` + `./dev shell` + local worker/web dev.

Iteration 3 (architecture/reference):

- Rewrite `docs/architecture.md` to match actual used bindings and code paths (no aspirational components without status).

## Drift traps to add (as we refactor)

- A test that enforces `DEPLOYMENT.md` must not instruct cross-origin browser production base.
- A test that enforces `docs/architecture.md` only lists subsystems that exist in config/code (or labels them Planned).
- A test that enforces canonical docs all have a Status header.

## Notes / audit log

- Add one bullet per iteration describing what changed and what evidence was used.

- 2026-01-02 (Iteration 1): Updated `docs/Runbooks.md` index links + status; marked `docs/REALITY_CHECKS.md` as Legacy snapshot with pointers to canonical operator docs; evidence: current devshell/runbooks layout and Path B drift traps.
- 2026-01-02 (Iteration 1b): Generated fresh receipts (cf:doctor/access:probe/ws:probe/pwa:probe) and added `docs/PROOF_REPORT.md` as the canonical evidence hub; updated `docs/PROJECT_STATE.md` to include proof pointers and to reflect the current PWA asset failure; evidence: `receipts/reality.2026-01-02T020958Z.*` and `receipts/pwa-probe.20260102-021015Z.json`.
- 2026-01-02 (Iteration 2): Rewrote onboarding + auth setup/debug docs to match actual scripts/code (correct local dev commands, removed `VITE_AUTH_TOKEN` guidance, aligned CORS allowlist, documented implemented auth modes) and added `apps/api-worker/.dev.vars.example`; evidence: `apps/web/src/lib/apiBaseUrl.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/hooks/useWebSocket.ts`, `apps/api-worker/src/lib/authContext.ts`, `apps/api-worker/src/middleware/cors.ts`, `scripts/verify-full.sh`, `scripts/verify-auth-setup.sh`.
- 2026-01-02 (Iteration 3): Rewrote `docs/architecture.md` + `docs/policy.md` to be evidence-only (bindings + entrypoints + current policy gate rules; removed unproven/aspirational claims); evidence: `apps/api-worker/wrangler.toml`, `apps/api-worker/src/index.ts`, `apps/api-worker/src/app.ts`, `apps/api-worker/src/do/ChatState.ts`, `apps/api-worker/src/services/*`, `packages/policy/src/*`, `apps/web/src/lib/apiBaseUrl.ts`.
- 2026-01-02 (Iteration 4): Rewrote `docs/API_REFERENCE.md` to match the Worker router and controller/service-verified request/response shapes (including Path B rewrite and `/api/voice-chat` alias); evidence: `apps/api-worker/src/app.ts`, `apps/api-worker/src/controllers/*`, `apps/api-worker/src/services/*`, `apps/api-worker/src/lib/schemas.ts`, `apps/api-worker/src/lib/preferencesRegistry.ts`, plus `pnpm test:node` (includes `test/docs_path_b_defaults.test.ts` and `test/docs_deployment_contract.test.ts`).
- 2026-01-02 (Iteration 4b): Post-edit re-verification pass: confirmed `docs/API_REFERENCE.md` status/header and Path B base guidance remain intact; confirmed auth docs’ `?token=` (WebSocket callers) and `VITE_AUTH_TOKEN` guardrail claims remain backed by code/scripts; re-ran `pnpm test:node` and kept all drift traps green; evidence: `docs/API_REFERENCE.md`, `docs/authentication-setup.md`, `apps/api-worker/src/lib/authContext.ts`, `scripts/verify-auth-setup.sh`, `scripts/guard-config-drift.mjs`.
- 2026-01-02 (Iteration 5): Promoted `docs/Onboarding.md`, `docs/authentication-setup.md`, `docs/auth-debugging.md`, `docs/architecture.md`, and `docs/policy.md` to Full after tightening to evidence-only claims (removed unverifiable operational advice; aligned token generator command to script usage); evidence: `package.json` engines, `scripts/bootstrap-dev.sh`, `scripts/verify-full.sh`, `scripts/generate-api-token.ts`, `apps/web/src/pages/Settings.tsx`, and `packages/policy/src/*`.
- 2026-01-02 (Iteration 6): Deprecated `docs/deploy-cloudflare.md` into a pointer doc (superseded by the receipts-first deploy runbook) and promoted `docs/CLOUDFLARE_SURFACE.md` to Full with current Path B route truth; evidence: `apps/api-worker/wrangler.toml` (routes include `chat.aperion.cc/api/*`), `wrangler.toml`, `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-web.yml`.
- 2026-01-02 (Iteration 7): Rewrote `README.md` as the canonical entrypoint (links + minimal verified local dev commands), deprecated `DEPLOYMENT.md` into a pointer page, and rewrote `SECURITY.md` to focus on in-repo guardrails (no platform claims); updated docs index Cloudflare section accordingly; evidence: `scripts/bootstrap-dev.sh`, `scripts/verify-full.sh`, `devshell/*`, `scripts/guard-prod-secrets.mjs`, `scripts/guard-config-drift.mjs`, `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-web.yml`.
- 2026-01-02 (Iteration 8): Promoted `docs/E2E_SELECTOR_CONTRACT.md` to Full and aligned it with actual `data-testid` hooks used by Playwright specs (conversation rows, message bubbles, conversations drawer); removed historical/unproven incident claims; evidence: `apps/web/test/e2e/*`, `apps/web/src/components/ConversationItem.tsx`, `apps/web/src/components/MessageBubble.tsx`, `apps/web/src/pages/Chat.tsx`.
- 2026-01-02 (Iteration 9): Regenerated `docs/openapi.json` using the in-repo generator script to reflect current worker routes/schemas; evidence: `apps/api-worker/scripts/generate-openapi.ts` + `apps/api-worker/package.json` (`docs:generate`).
- 2026-01-02 (Iteration 10): Deprecated `AUTHENTICATION_IMPLEMENTATION.md` into a strict Legacy pointer doc (historical context only; no current-state claims); evidence: canonical replacements `docs/authentication-setup.md` + `docs/PROJECT_STATE.md`.
- 2026-01-02 (Iteration 11): Labeled planning/roadmap docs as Legacy snapshots with explicit status headers and non-canonical disclaimers (no “already shipped” posture); also removed “single source of truth” wording from `docs/ROADMAP_PHASE_5.md`; evidence: docs status rubric + canonical replacements `docs/PROJECT_STATE.md`, `docs/DEPLOY_PROD_RUN.md`, `docs/API_REFERENCE.md`.
- 2026-01-02 (Iteration 12): Labeled remaining planning-ish docs as Legacy snapshots and removed “single source of truth” posture (`docs/RELIABILITY_PLAN.md`, `docs/CLOUDFLARE_UPGRADE_PLAN.md`, `docs/path-b/PHASE_2_DESIGN.md`); populated `docs/ENTERPRISE_UI_RECOMMENDATIONS.md` as a Legacy pointer to canonical UI contracts + the historical HTML export; evidence: docs status rubric + canonical replacements `docs/PROJECT_STATE.md`, `docs/DEPLOY_PROD_RUN.md`, `docs/CLOUDFLARE_SURFACE.md`, `docs/E2E_SELECTOR_CONTRACT.md`.
- 2026-01-02 (Iteration 13): Path B docs consistency pass: ensured all `docs/path-b/*` files have explicit “historical snapshot” disclaimers and point to canonical current docs (`docs/PROJECT_STATE.md`, `docs/DEPLOY_PROD_RUN.md`).
- 2026-01-02 (Iteration 14): Rewrote `docs/DEPLOY_PROD.md` as an evidence-only configuration contract (no runbook steps); grounded claims in guard scripts and auth/WS code paths; evidence: `scripts/guard-config-drift.mjs`, `scripts/guard-prod-secrets.mjs`, `apps/web/src/lib/apiBaseUrl.ts`, `apps/api-worker/src/lib/authContext.ts`, `apps/api-worker/src/do/ChatState.ts`.
- 2026-01-02 (Iteration 14b): Tightened `docs/DEPLOY_PROD_RUN.md` Preconditions to explicitly treat `docs/DEPLOY_PROD.md` as the configuration contract it depends on (no runbook duplication).
