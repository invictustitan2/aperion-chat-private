# Production Deploy Runbook (Worker + Pages + Access)

This runbook is meant to be executed top-to-bottom when deploying production.

## Preconditions (must already be true)

- Cloudflare Access is configured as described in [docs/DEPLOY_PROD.md](docs/DEPLOY_PROD.md).
- Worker production vars are set (at minimum: `APERION_AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`).
- Pages production env var is set: `VITE_API_BASE_URL=https://api.aperion.cc`.

### Required configuration (where each value lives)

Cloudflare Worker production vars (required):

- `APERION_AUTH_MODE=access`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `NODE_ENV=production`
- `API_TOKEN` (secret)

Cloudflare Pages production env vars (required):

- `VITE_API_BASE_URL=https://api.aperion.cc`

GitHub Actions secrets (required for deploy + post-deploy authenticated checks):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CF_ACCESS_SERVICE_TOKEN_ID`
- `CF_ACCESS_SERVICE_TOKEN_SECRET`

## 1) Local preflight (must be green)

Run from repo root:

- `pnpm verify`
- `pnpm -r build`
- `pnpm guard:prod-secrets`
- `pnpm guard:config-drift`
- `pnpm test:e2e`

## 2) Deploy (recommended path: GitHub Actions)

Deploy order is always **Worker → Pages**.

### 2.1 Deploy API Worker

- GitHub Actions → run workflow: **Deploy API Worker** on branch `main`.

Notes:

- If `CF_ACCESS_SERVICE_TOKEN_ID` + `CF_ACCESS_SERVICE_TOKEN_SECRET` are present in GitHub Secrets, the workflow performs a post-deploy authenticated check.
- If they are not present, the workflow skips the check (production should still be protected by Access).

### 2.2 Deploy Web App (Cloudflare Pages)

- GitHub Actions → run workflow: **Deploy Web App** on branch `main`.

## 3) Deploy (fallback path: CLI)

Use this only if you intentionally are not deploying via GitHub Actions.

### 3.1 Deploy API Worker

- `cd apps/api-worker && npx wrangler deploy`

### 3.2 Deploy Pages

- `cd apps/web && pnpm build && npx wrangler pages deploy dist --project-name aperion-chat-private`

## 4) Post-deploy smoke tests

### 4.1 HTTP (Access boundary)

Without an Access service token (expected: protected):

- `curl -i https://api.aperion.cc/v1/identity`
  - Expected: not `200` (commonly `302` or `403` from Access, or `401` if Access allows through but Worker denies)

With an Access service token (expected: `200`):

- `curl -i \
-H "CF-Access-Client-Id: $CF_ACCESS_SERVICE_TOKEN_ID" \
-H "CF-Access-Client-Secret: $CF_ACCESS_SERVICE_TOKEN_SECRET" \
https://api.aperion.cc/v1/identity`

### 4.1.1 Diagnosing `302` with a service token

If a request _with_ `CF-Access-Client-Id` / `CF-Access-Client-Secret` still returns `302`, Cloudflare Access rejected the service token for this application/hostname/path.

First local check (prints only status + `Location` + `cf-ray`, never prints secrets):

- `bash scripts/access-token-diagnose.sh`

What to verify in Cloudflare Zero Trust:

- Access Application domain/path matches `api.aperion.cc` and the `v1` API paths (e.g. `https://api.aperion.cc/v1/*`).
- The Access policy for that application explicitly includes the intended service token.
- The service token belongs to the same Zero Trust account as the application.
- There is no second Access application that also matches `api.aperion.cc` (conflicting precedence can yield unexpected `302`).

### 4.2 Web

- Open `https://chat.aperion.cc` in a fresh browser session.
  - Expected: Access prompts you to authenticate.
  - Expected after auth: UI loads and can fetch `/v1/identity` successfully.

### 4.3 WebSocket

Run the included smoke script:

- Unauthenticated (expected to fail behind Access):
  - `node scripts/smoke-ws.mjs`

- Authenticated (recommended):
  - `pnpm smoke:prod:interactive`

Notes:

- A direct `node scripts/smoke-ws.mjs` invocation will only work for authenticated smoke if that script explicitly supports adding Cloudflare Access headers during the WebSocket handshake.
- The interactive smoke runner uses an `undici` WebSocket shim and supplies Access headers for the authenticated WS check.

Interpretation:

- `event: open` → WS handshake succeeded.
- `event: close code=1008` → DO policy-denied an established socket (defense-in-depth).
- `event: close code=1006` or `event: error ...` → typical when Access denies the handshake.

## 5) Rollback (minimal)

- Re-deploy previous known-good Worker version (via Cloudflare dashboard rollback or `wrangler` version history).
- Re-deploy previous known-good Pages deployment.

---

## Appendix: keep `apps/web/dist` Vite-only

`apps/web/dist` is the Cloudflare Pages deploy artifact. It must contain only the Vite build output.

Why this matters:

- CI runs `pnpm guard:prod-secrets`, which scans `apps/web/dist` for forbidden prod token hints (including the literal string `VITE_AUTH_TOKEN`).
- TypeScript project builds (`pnpm typecheck` → `tsc -b`, and `apps/web`’s `pnpm build` → `tsc && vite build`) must never emit compiled files (especially tests) into `apps/web/dist`, or the guard will correctly fail.

If you ever see `apps/web/dist/test/**` or `*.spec.js` appear under `dist`, fix the TypeScript config so its emit output is redirected elsewhere (e.g. `apps/web/.tsbuild`) or disabled, rather than weakening `guard:prod-secrets`.
