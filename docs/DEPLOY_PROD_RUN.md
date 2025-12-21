# Production Deploy Runbook (Worker + Pages + Access)

This runbook is meant to be executed top-to-bottom when deploying production.

## Preconditions (must already be true)

- Cloudflare Access is configured as described in [docs/DEPLOY_PROD.md](docs/DEPLOY_PROD.md).
- Worker production vars are set (at minimum: `APERION_AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`).
- Pages production env var is set: `VITE_API_BASE_URL=https://api.aperion.cc`.

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

### 4.2 Web

- Open `https://chat.aperion.cc` in a fresh browser session.
  - Expected: Access prompts you to authenticate.
  - Expected after auth: UI loads and can fetch `/v1/identity` successfully.

### 4.3 WebSocket

Run the included smoke script:

- Unauthenticated (expected to fail behind Access):
  - `node scripts/smoke-ws.mjs`

- Authenticated via Access service token headers (expected to open then close cleanly):
  - `CF_ACCESS_SERVICE_TOKEN_ID=... CF_ACCESS_SERVICE_TOKEN_SECRET=... node scripts/smoke-ws.mjs`

Interpretation:

- `event: open` → WS handshake succeeded.
- `event: close code=1008` → DO policy-denied an established socket (defense-in-depth).
- `event: close code=1006` or `event: error ...` → typical when Access denies the handshake.

## 5) Rollback (minimal)

- Re-deploy previous known-good Worker version (via Cloudflare dashboard rollback or `wrangler` version history).
- Re-deploy previous known-good Pages deployment.
