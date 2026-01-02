# Verification Checklist (Evidence-First)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev + Operator
> \
> **Canonical for:** How to verify the repo locally and (optionally) against production with receipts

This checklist is intentionally **evidence-first**:

- Prefer repo-enforced gates (`pnpm verify`, `pnpm test:e2e`, drift traps).
- Prefer deterministic probes (`./dev access:probe`, `./dev ws:probe`, `./dev pwa:probe`) over manual browser guessing.
- Any production claim should be backed by receipts (see `docs/PROOF_REPORT.md`).

## 0) Read the current reality first

- Canonical current-state doc: `docs/PROJECT_STATE.md`
- Canonical evidence hub: `docs/PROOF_REPORT.md`

If any other doc conflicts with these, treat it as drift unless proven.

## 1) Repo health (no-network)

From repo root:

- `pnpm -s test:node`
- `pnpm -s test:web`
- `./dev verify:ci`

What these prove:

- Unit/integration tests are green.
- Drift traps for Path B + deploy docs are green.

## Completion log (this machine)

Append one line per run. Keep it short and evidence-oriented.

- 2026-01-02T04:29:26Z — Started checklist execution.
- 2026-01-02T05:13:56Z — `pnpm -s test:node` PASS (48 files, 189 tests).
- 2026-01-02T04:31:53Z — `pnpm -s test:web` PASS (23 files, 162 tests; 1 skipped).
- 2026-01-02T05:25:35Z — `pnpm -s test:e2e` PASS (19 tests).
- 2026-01-02T04:31:53Z — `./dev verify:ci` PASS (cf:doctor PASS=16; `pnpm typecheck`, `pnpm lint`, `pnpm test` PASS; `guard:prod-secrets` OK; `guard:config-drift` OK).
- 2026-01-02T04:33:49Z — `./scripts/bootstrap-dev.sh` PASS (toolchain verification OK; bootstrap complete).
- 2026-01-02T04:36:32Z — `./scripts/verify-full.sh` PASS (API ready at `http://127.0.0.1:8787`; `pnpm verify` PASS).
- 2026-01-02T04:40:52Z — Local API probes PASS (started local worker, then: `/v1/identity`=401, `/v1/preferences/theme`=401, `OPTIONS /v1/conversations`=204).
- 2026-01-02T04:43:45Z — `RUN_NETWORK_TESTS=1 ./dev pwa:probe` FAIL (`PWA.PUBLIC.OK: no`; receipt: `receipts/pwa-probe.20260102-044232Z.json`).
- 2026-01-02T04:43:45Z — `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser` OK (`/api/v1/*` endpoints=200; WS upgrade=101; WS proof connected + pong).
- 2026-01-02T04:43:45Z — `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface api` OK (`/v1/*` endpoints=200; WS upgrade=101; WS proof connected + pong).
- 2026-01-02T05:22:45Z — `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser` OK (receipt: `receipts/validate/latest.browser.txt`; WS proof CONNECTED=yes; PONG_RECEIVED=yes).
- 2026-01-02T05:22:45Z — `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface api` OK (receipt: `receipts/validate/latest.api.txt`; WS proof CONNECTED=yes; PONG_RECEIVED=yes).
- 2026-01-02T05:29:31Z — `./dev cf:doctor --json` PASS (receipt: `receipts/reality.2026-01-02T05:29:31Z.cf-doctor.json`; PASS=16).
- 2026-01-02T04:44:49Z — `./dev cf:access:audit --surface browser` EVIDENCE (`Aperion Chat (UI)` domain `chat.aperion.cc/*` covers static paths; service-auth policy exists but no public bypass noted).
- 2026-01-02T04:45:58Z — `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser` EVIDENCE (receipt: `receipts/access-probe.browser.20260102-044514Z.txt`; with service token: `/api/v1/*`=200; without: 302 to Access login).
- 2026-01-02T04:45:58Z — `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser` EVIDENCE (receipt: `receipts/ws-probe.browser.20260102-044527Z.txt`; with token: GET=426, Upgrade=101; without: 302 to Access login).
- 2026-01-02T05:21:22Z — `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser` EVIDENCE (receipt: `receipts/access-probe.browser.20260102-052132Z.txt`; tooling now writes receipts).
- 2026-01-02T05:21:22Z — `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser` EVIDENCE (receipt: `receipts/ws-probe.browser.20260102-052140Z.txt`; tooling now writes receipts).
- 2026-01-02T05:16:02Z — `RUN_NETWORK_TESTS=1 ./dev ws:proof --surface browser --mode headless` PASS (receipt: `receipts/ws-proof.browser.20260102-051558Z.json`; CONNECTED=yes).
- 2026-01-02T05:07:38Z — `RUN_NETWORK_TESTS=1 ./dev pwa:probe` PARTIAL (receipt: `receipts/pwa-probe.20260102-050719Z.json`; `/manifest.json`=200; `/favicon.ico` and `/robots.txt` still 302 to Access login).
- 2026-01-02T05:07:58Z — Public icon fetch OK (`/icon-192.png`=200; `/icon-512.png`=200; no Access redirect).
- 2026-01-02T05:11:54Z — `RUN_NETWORK_TESTS=1 ./dev pwa:probe` PASS (receipt: `receipts/pwa-probe.20260102-051154Z.json`; `/manifest.json`=200; `/favicon.ico`=200; `/robots.txt`=200; no Access redirect).

## 2) Bootstrap local tooling

From repo root:

- `./scripts/bootstrap-dev.sh`

Then open the dev shell:

- `./dev shell`

Secrets expectations:

- Default secrets file: `~/.config/aperion/cf_access.env`
- Override path: `APERION_SECRETS_FILE=/path/to/cf_access.env ./devshell/devshell secrets check`

Notes:

- Networked checks are **disabled by default**. Enable with `RUN_NETWORK_TESTS=1`.

## 3) Local Worker: start + verify core readiness

Canonical local “full verification cycle”:

- `./scripts/verify-full.sh`

What it actually does (by code):

- Starts a local Worker on `http://127.0.0.1:8787`
- Waits for `/v1/identity` to respond (200/401/403 are all treated as “ready”)
- Runs `pnpm verify` (typecheck + lint + tests)

Important:

- `./scripts/verify-full.sh` does **not** run Playwright E2E.
- Run E2E separately when needed: `pnpm -s test:e2e`

## 4) Local API behavior: validate against the canonical reference

Canonical API contract:

- `docs/API_REFERENCE.md`

Source of truth for routing:

- `apps/api-worker/src/app.ts`

Suggested approach:

- Pick a small subset of endpoints you care about.
- Call them against `http://127.0.0.1:8787/v1/*`.
- Compare observed status codes and response shapes to `docs/API_REFERENCE.md`.

Preferences registry (provable):

- Allowed preference keys are exactly: `theme`, `ai.tone`.
- Unknown keys should return 404.

Source of truth: `apps/api-worker/src/lib/preferencesRegistry.ts`.

## 5) Auth model sanity checks (local)

Production uses Cloudflare Access (`APERION_AUTH_MODE=access`). Locally, you typically use one of:

- `token` / `hybrid` mode with `API_TOKEN` (bearer auth), or
- Service-token headers (for scripted probes): `CF-Access-Client-Id` + `CF-Access-Client-Secret`.

What the Worker actually supports (source of truth): `apps/api-worker/src/lib/authContext.ts`.

Notes:

- In `access` mode, missing/invalid Access assertion yields 401/500 with explicit reason strings.
- The browser cannot set `Authorization` for WebSocket upgrades; for non-browser callers, WS supports `?token=` in token/hybrid modes.

## 6) WebSocket behavior (local + production)

What to treat as canonical acceptance proofs (production surfaces):

- `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser` (upgrade proof)
- `RUN_NETWORK_TESTS=1 ./dev ws:proof --surface browser --mode headless` (data-plane ping/pong proof)

Important nuance (avoid drift):

- WebSocket close code `1006` is commonly an _opaque symptom_ at the client when Access redirects or the browser is unauthenticated.
- Policy-deny behavior in the Durable Object path is an explicit close with code `1008`.

Source of truth:

- DO upgrade enforcement: `apps/api-worker/src/do/ChatState.ts`

## 7) Browser / Path B contract

Canonical statement:

- Production browser traffic should be same-origin under `/api`.
  - REST: `https://chat.aperion.cc/api/v1/*`
  - WS: `wss://chat.aperion.cc/api/v1/ws`

Evidence:

- Web prod default: `apps/web/src/lib/apiBaseUrl.ts`
- Worker route mount: `apps/api-worker/wrangler.toml`
- Drift traps: `test/docs_path_b_defaults.test.ts`, `test/workflows_deploy_web_path_b.test.ts`

## 8) Optional: production/networked verification (receipt-backed)

These are opt-in and write receipts:

- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev pwa:probe`
- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface api`

Canonical evidence index:

- `docs/PROOF_REPORT.md`

## If you find a mismatch

- If code differs from docs: fix docs (preferred) unless it’s a real bug.
- If docs claim something without evidence: mark it Planned/Legacy or remove it.
- If a contract is critical: add/extend a drift trap test.
