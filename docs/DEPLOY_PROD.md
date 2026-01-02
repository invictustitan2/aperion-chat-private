# Production Deployment Checklist (Cloudflare Workers + Pages + Access)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator (solo)
> \
> **Canonical for:** Production config contract (vars, bindings, and browser base URL rules)

This doc is **not** an execution runbook. It is the “what must be configured / what the code expects” contract.

For the step-by-step execution runbook (exact commands + smoke tests + receipts), see [docs/DEPLOY_PROD_RUN.md](docs/DEPLOY_PROD_RUN.md).

Quick self-checks (repo-enforced):

- `pnpm guard:config-drift` (Worker binding + env-var-name contract; web config invariants)
- `pnpm -C apps/web build && pnpm guard:prod-secrets` (web build output must not contain prod token hints)

Path B note (same-origin API): production browser traffic is same-origin under `https://chat.aperion.cc/api/v1/*` (the web app defaults to `/api` in production builds). `https://api.aperion.cc/v1/*` remains supported for tooling/back-compat.

## Evidence map (where these claims come from)

- Worker bindings + var-name contract guard: `scripts/guard-config-drift.mjs` (run via `pnpm guard:config-drift`)
- Web prod-secret guard (dist scan): `scripts/guard-prod-secrets.mjs` (run via `pnpm guard:prod-secrets`)
- Browser API base URL rules: `apps/web/src/lib/apiBaseUrl.ts`
- Worker Access auth behavior: `apps/api-worker/src/lib/authContext.ts`
- WS upgrade deny (policy close 1008): `apps/api-worker/src/do/ChatState.ts` + `apps/api-worker/test/lib/wsDeny.test.ts`

## Cloudflare Access requirements (what the Worker verifies)

The API Worker supports three auth modes (`APERION_AUTH_MODE`: `access` | `hybrid` | `token`).

In `access` mode:

- The Worker expects an Access assertion token via:
  - `CF-Access-Jwt-Assertion` (or `X-CF-Access-Jwt-Assertion`), or
  - `CF_Authorization` cookie.
- If `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` is missing, the Worker fails closed with a **500** and a clear reason string.
- The Worker verifies:
  - JWT issuer `iss` matches `https://${CF_ACCESS_TEAM_DOMAIN}` (team slug is allowed and normalized), and
  - JWT audience `aud` matches `CF_ACCESS_AUD`.

`CF_ACCESS_AUD` supports a comma-separated allowlist (example: `aud-api,aud-chat`), which allows separate Access apps/surfaces if desired.

This doc does not prescribe how many Access apps to create; it only documents what the Worker validates.

## Worker (Cloudflare Workers) configuration

Worker name/config lives in `apps/api-worker/wrangler.toml`.

### 2.1 Variables vs Secrets

Set these in **Cloudflare Dashboard → Workers & Pages → (your Worker) → Settings → Variables**.

**Required (Access auth):**

- `APERION_AUTH_MODE` (Variable): choose `access` to require Access assertions.
- `CF_ACCESS_TEAM_DOMAIN` (Variable): Access team domain (slug or full domain).
- `CF_ACCESS_AUD` (Variable): Access audience allowlist (single AUD or comma-separated list).

**Optional (production):**

- `APERION_AUTH_LOG_OUTCOMES` (Variable) = `deny` (default) or `all`
- `CF_ACCESS_JWKS_TTL_MS` (Variable)
- `CF_ACCESS_JWT_CLOCK_SKEW_SECONDS` (Variable)
- `CF_ACCESS_SERVICE_TOKEN_ID` (Secret recommended)
- `CF_ACCESS_SERVICE_TOKEN_SECRET` (Secret)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Secret)
- `GEMINI_API_KEY` (Secret)
- `GEMINI_MODEL` (Variable)

Legacy token support (dev/test tooling only):

- `API_TOKEN` (Secret): only needed for `APERION_AUTH_MODE=token|hybrid` flows.

### 2.2 Worker Bindings (names are exact)

Bindings referenced by code via `env.<NAME>` (and/or declared by Wrangler types):

Repo-enforced binding contract (validated by `pnpm guard:config-drift`):

- Default env must include:
  - `MEMORY_DB` (D1)
  - `CHAT_STATE` (Durable Object namespace)
  - `AI` (Workers AI binding)
- Preview env must include (minimum):
  - `MEMORY_DB`
  - `CHAT_STATE`

Other bindings are declared in `apps/api-worker/wrangler.toml` (e.g. `MEMORY_VECTORS`, `CACHE_KV`, `MEMORY_QUEUE`, `MEDIA_BUCKET`, `BROWSER`, `METRICS`). Whether they are required depends on which routes/features you use.

## 3) Pages (Cloudflare Pages) Settings

The web app reads these env vars via Vite `import.meta.env.*`:

**Required:**

- `VITE_API_BASE_URL` is the supported configuration knob for the browser’s API base URL.

Behavior if unset:

- In production builds: defaults to same-origin `"/api"`.
- In dev builds: defaults to local dev worker `http://127.0.0.1:8787`.

For production, prefer `VITE_API_BASE_URL=/api` (Path B). Setting an absolute base (like `https://api.aperion.cc`) changes the browser contract and should be treated as an explicit operational choice.

**Optional (dev/test only):**

- `VITE_AUTH_MODE`

Explicitly forbidden in production:

- `VITE_AUTH_TOKEN` must **not** exist (and must not appear in built output). CI enforces this via `pnpm guard:prod-secrets`.

Where to set:

- Cloudflare Dashboard → Pages → your project → Settings → Environment variables → **Production**.

For deploy order, smoke tests, and receipt-backed validation commands, use the canonical runbook: [docs/DEPLOY_PROD_RUN.md](docs/DEPLOY_PROD_RUN.md).
