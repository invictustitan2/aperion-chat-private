## Plan: Cloudflare Access Auth Unification (JWKS + DO-Safe)

Replace the current static bearer-token and WS query-token auth with a single, shared “auth truth” based on **Cloudflare Zero Trust Access** identity for both HTTP and WebSocket traffic. Implement **real Access JWT verification (JWKS)** and ensure the **Durable Object re-verifies** auth at WS accept time (the DO must not trust an unsigned userId).

Keep legacy bearer token auth only for local/dev/test behind an explicit `APERION_AUTH_MODE` contract that **fails closed in prod** when Access config is missing. Then add prod-safe WS close-code logging + spam reduction, make preferences return defaults for known keys, and strip/gate Settings debug/token info in production. Update unit + e2e tests to keep `pnpm test` and `pnpm test:e2e` green.

### Current Status (2025-12-21)

**Implemented (done):**

- **Cloudflare Access auth (JWKS verify) as the single auth “truth”** for HTTP + WS via a shared resolver (`getAuthContext`).
- **Durable Object boundary secured:** the DO re-verifies auth before accepting WebSocket upgrades and closes unauthenticated sockets with a policy code.
- **Request log hardening:** redacts sensitive query params (e.g. `?token=`) so legacy token fallbacks don’t leak into logs.
- **Preferences contract stabilized:** known keys (currently `ai.tone`) never 404; missing returns defaults; invalid values rejected; unknown keys remain 404.
- **Web client cutover:** prod/test rely on Access session (no bearer headers / no WS `?token=`); dev can still use token mode.
- **WS UX improvements:** close-code logging + reconnect backoff and reduced warning spam.
- **Settings production safety:** debug/auth token UI gated to dev only; no `VITE_AUTH_TOKEN` leak strings in prod UI; added Playwright guardrails.

**Tests:**

- ✅ `pnpm test` is green (node + web Vitest).
- ✅ `pnpm test:e2e` is green (19 Playwright specs).
- ✅ `pnpm typecheck` is green.
- ✅ `pnpm lint` is green (note: eslint prints a warning about TS 5.9.x not being in the officially supported range for `@typescript-eslint`, but it does not fail the run).

Recent Playwright stability fixes:

- `apps/web/test/e2e/chat.spec.ts`: fixed strict-mode ambiguity where `getByText("My new message")` matched both the message bubble and the textarea.
- `apps/web/test/e2e/qa_evidence.spec.ts`: stabilized mobile drawer flow with `data-testid` selectors, scrim dismiss click computed from the drawer bounding box (no baked-in width assumptions), and realistic `/v1/episodic` GET+POST mocks so history renders.
- ✅ Verified: `pnpm test:e2e -- apps/web/test/e2e/qa_evidence.spec.ts` (1 test passed).

**Remaining to finish (blocking “ready”):**

- (Optional) Do a manual smoke test in a real Access-protected environment (`api.aperion.cc` + `/v1/ws`) to validate dashboard config and cookie/header behavior.

### Readiness Deliverables (Final)

#### A) Current Behavior Summary (short)

- **HTTP auth path:** Worker middleware uses a single resolver (`getAuthContext`) and enforces Cloudflare Access as the primary auth source. It accepts Access JWT assertions from `CF-Access-Jwt-Assertion` (preferred) or `CF_Authorization` cookie (fallback), verifies RS256 via JWKS (`/cdn-cgi/access/certs`), and checks `iss`/`aud`/`exp`/`nbf`.
- **WS auth path:** `/v1/ws` is routed through the Worker to the Durable Object, and the Durable Object re-verifies auth before accepting the upgrade (fail-closed). Unauthenticated sockets are closed with policy close code `1008`.
- **Preferences behavior:** known preference keys never 404. Missing values return defaults (currently `ai.tone = "default"`). Invalid values are rejected; unknown keys remain 404.
- **Settings debug gating:** Settings debug/auth token UI is DEV-only (no token leak strings in production UI).

#### B) Cloudflare Dashboard Checklist (Access)

1. **Zero Trust → Access → Applications → Add an application**
   - Create a **Self-hosted** application for `chat.aperion.cc`.
   - Create a **Self-hosted** application for `api.aperion.cc`.
     - Include paths:
       - `api.aperion.cc/v1/*` (covers HTTP)
       - `api.aperion.cc/v1/ws` (WS upgrade endpoint)
2. **Policies**
   - Create an **Allow** policy scoped to the intended identity (email / IdP group). Keep it strict.
3. **Get the AUD**
   - In the Access application settings, capture the **AUD** value.
   - Configure worker env:
     - `CF_ACCESS_TEAM_DOMAIN` (team slug or full `*.cloudflareaccess.com` domain)
     - `CF_ACCESS_AUD` (from the app)
     - `APERION_AUTH_MODE=access`
4. **JWKS availability check**
   - Confirm `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` is reachable.
5. **(Optional) Service token for CI/automation**
   - Create a service token, store it securely, and pass as:
     - `CF-Access-Client-Id`
     - `CF-Access-Client-Secret`
6. **Where to confirm auth is working**
   - Requests to `api.aperion.cc` should carry `CF-Access-Jwt-Assertion` when Access is applied.
   - Worker logs should not contain raw `?token=` values (URL sanitization).
7. **WS troubleshooting**
   - If WS fails, check the close code and reason (client should surface code; server uses `1008` for auth failures).
   - Confirm Access application includes the `/v1/ws` path.

#### C) Manual Smoke Test Steps (Access-protected)

1. **UI requires Access login**
   - Visit `https://chat.aperion.cc/chat` and confirm Access prompts for login.
2. **HTTP calls succeed under Access**
   - Load Chat; confirm conversations/history API requests are `200` (no bearer tokens required).
3. **WS connects**
   - Confirm the UI connection indicator shows connected.
   - If it disconnects, inspect the logged close code/reason.
4. **Preferences default behavior**
   - Call `GET https://api.aperion.cc/v1/preferences/ai.tone` and confirm it returns `200` with default when unset.
5. **Settings is production-safe**
   - Visit Settings and confirm no token values or “set VITE_AUTH_TOKEN” hints are shown in production.

#### D) What Changed (file list)

- `apps/api-worker/src/lib/authContext.ts` (Access JWKS verification + cache; legacy token handling; typecheck hardening)
- `apps/api-worker/src/do/ChatState.ts` (DO re-verifies auth before WS accept; typecheck visibility fix)
- `apps/api-worker/src/middleware/*` (auth/context/cors wiring and logging sanitization)
- `apps/api-worker/src/controllers/PreferencesController.ts` + tests (known keys never 404; defaults/validation)
- `apps/web/src/pages/Chat.tsx` (drawer `data-testid` hooks, mobile behavior)
- `apps/web/src/components/MessageBubble.tsx` (stable message bubble test ids)
- `apps/web/test/e2e/qa_evidence.spec.ts` (drawer geometry-based scrim dismiss; episodic GET/POST mock; screenshots dir creation; stable selectors)
- `apps/web/test/e2e/chat.spec.ts` (strict-mode selector hardening)

### Post-Ready Hardening & Observability (append-only)

#### Security Invariants

- **Single auth truth:** HTTP and WS both use `getAuthContext` and enforce the same `APERION_AUTH_MODE` contract.
- **Fail closed in access mode:** if Access assertions are missing, requests must return `401` (and never silently fall back to legacy tokens).
- **DO boundary remains strict:** the Durable Object re-verifies auth on WS upgrades and will policy-close unauthenticated upgrades (`1008`).
- **No secrets in logs:** never log raw tokens, Access assertions, cookies, or query params.

#### Do Not Do

- Do not re-introduce browser reliance on `VITE_AUTH_TOKEN` in production.
- Do not add token/env-var hints to shipped web bundles (guarded by `pnpm guard:prod-secrets`).
- Do not skip DO re-verification by passing a userId from the Worker.
- Do not log full URLs with sensitive query params (e.g. `?token=`).

#### Observability Toggle

- `APERION_AUTH_LOG_OUTCOMES=deny|all` controls whether successful auth + WS upgrade accepts are logged (`deny` is low-noise default).

### Steps

1. **Recon deliverables (no assumptions):** produce a short “current behavior” summary (HTTP auth, WS auth, preferences behavior, Settings token/debug UI), and include the **Cloudflare dashboard checklist + validation steps** as a first-class deliverable.
2. **Auth mode contract (fail closed):** define and enforce `APERION_AUTH_MODE=access|hybrid|token`.
   - `access` (prod default): requires Access JWT + JWKS config; no bearer token.
   - `hybrid` (temporary migration): Access first, bearer token allowed only in dev/test.
   - `token` (dev/test only): bearer token allowed.
3. **Single auth truth:** implement `getAuthContext(request, env)` + `requireAuth(authCtx)`.
   - Primary: Access JWT (`CF-Access-Jwt-Assertion`) verified via JWKS.
   - Optional: Access Service Token (`CF-Access-Client-Id` / `CF-Access-Client-Secret`) for automation.
   - Legacy: bearer token (dev/test only per `APERION_AUTH_MODE`).
4. **Apply to HTTP first (stabilize):** update middleware/router so all `/v1/*` handlers use the auth resolver; add/adjust tests.
5. **WS + Durable Object boundary (explicit rule):** re-run `getAuthContext()` inside the DO before accepting the WebSocket.
   - Deny unauthenticated upgrades; close with meaningful code (e.g., `1008` policy violation).
6. **Web client cutover (prod-safe):** remove reliance on `VITE_AUTH_TOKEN` for browser HTTP/WS in prod; keep dev-only token support.
7. **WS close-code logging + spam reduction:** log one `onclose` line (code/reason/wasClean), add backoff+jitter reconnect, and throttle “cannot send” warnings.
8. **Preferences registry defaults:** known keys never 404; return defaults on missing. Canonical: `ai.tone="default"`.
9. **Prod Settings sanitization:** ensure no token values or “Ensure VITE_AUTH_TOKEN…” hints render in prod; DEV-only debug blocks allowed.

### Further Considerations

1. **Access JWKS config (minimal env vars):** `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`.
2. **Service token identity mapping:** keep it boring and explicit (`principalType: "email"|"service"`, `principalId: <email|serviceName>`; `userId` always a string).
3. **DO safety invariant:** DO must be secure if called directly; either re-verify Access in DO (recommended) or accept only a worker-signed short-lived assertion (second-best).
