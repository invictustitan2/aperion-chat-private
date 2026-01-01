# Production Deployment Checklist (Cloudflare Workers + Pages + Access)

This doc is generated from what the repo code and configs actually read.

Path B note (same-origin API): this checklist reflects the **current** production contract where the browser calls the API on `https://api.aperion.cc` via `VITE_API_BASE_URL`. Path B is implemented in the repo (Worker route + `/api/v1/*` rewrite + web support for a relative `/api` base), but must not be assumed live until the rollout steps in `docs/path-b/PHASE_3_MIGRATION.md` are executed and verified.

For a step-by-step execution runbook (exact commands + smoke tests), see [docs/DEPLOY_PROD_RUN.md](docs/DEPLOY_PROD_RUN.md).

## Hard Constraints (enforced by code/CI)

- **Production auth mode is Access/JWKS**: `APERION_AUTH_MODE=access` and the Worker **fails closed** if Access config is missing.
- **Web UI is Access-session-only**: it must **not** ship any `VITE_AUTH_TOKEN` references (CI enforces this).
- **Durable Object re-verifies auth on WS accept** and policy-closes unauthenticated upgrades with code **1008**.

## 1) Cloudflare Access Setup (Zero Trust)

Create **two** Self-hosted applications:

1. **Chat UI app**
   - **Application domain**: `chat.aperion.cc`
   - **Paths**: `/*`

Note: After Path B rollout, browser API and WS traffic is still under this domain (e.g. `/api/v1/*` and `/api/v1/ws`), so this app continues to protect the same-origin surface.

2. **API app**
   - **Application domain**: `api.aperion.cc`
   - **Paths**:
     - `/v1/*`
     - `/v1/ws`

Policies (single-operator system):

- Add an **Allow** policy for exactly the one human operator (email / IdP identity).
- Keep a default-deny posture.

Critical: **Copy the AUD** from the **API** Access application.

## 2) Worker (Cloudflare Workers) Settings

Worker name/config lives in `apps/api-worker/wrangler.toml`.

### 2.1 Variables vs Secrets

Set these in **Cloudflare Dashboard → Workers & Pages → (your Worker) → Settings → Variables**.

**Required (production):**

- `APERION_AUTH_MODE` (Variable) = `access`
- `CF_ACCESS_TEAM_DOMAIN` (Variable) = your Access team domain (slug or full domain)
- `CF_ACCESS_AUD` (Variable) = Access app audience allowlist. For Path B, set this to a comma-separated list that includes both:
  - the API Access app AUD (for `api.aperion.cc`), and
  - the Chat UI Access app AUD (for `chat.aperion.cc/api/*`)

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

Required for the production API behavior:

- [ ] `MEMORY_DB` (D1)
- [ ] `CHAT_STATE` (Durable Object namespace)
- [ ] `AI` (Workers AI binding)

Optional / feature-gated (code tolerates missing in some routes):

- [ ] `MEMORY_VECTORS` (Vectorize)
- [ ] `MEMORY_QUEUE` (Queue producer)
- [ ] `MEDIA_BUCKET` (R2)
- [ ] `BROWSER` (Browser Rendering fetcher)
- [ ] `METRICS` (Analytics Engine dataset)
- [ ] `CACHE_KV` (KV) _(currently declared in Wrangler types/config; not referenced by Worker code paths)_

If any required binding is missing, deployment may succeed but runtime requests will fail.

## 3) Pages (Cloudflare Pages) Settings

The web app reads these env vars via Vite `import.meta.env.*`:

**Required (production):**

- Current (cross-origin): `VITE_API_BASE_URL=https://api.aperion.cc`

After Path B rollout (same-origin):

- Prefer relative base: `VITE_API_BASE_URL=/api`, or
- Unset `VITE_API_BASE_URL` to use the production default `/api`.

Do not switch production to `/api` (or unset `VITE_API_BASE_URL`) until `chat.aperion.cc/api/*` is actually routed to the Worker and validated.

**Optional (dev/test only):**

- `VITE_AUTH_MODE`

Explicitly forbidden in production:

- `VITE_AUTH_TOKEN` must **not** exist (and must not appear in built output). CI enforces this via `pnpm guard:prod-secrets`.

Where to set:

- Cloudflare Dashboard → Pages → your project → Settings → Environment variables → **Production**.

## 4) Deploy Order (must be Worker → Pages)

1. Deploy Worker first (so the UI always points at a live API).
2. Deploy Pages second.

## 5) Smoke Tests (expected outcomes)

Run these after deploy:

### 5.1 HTTP auth

- With a valid Access session:
  - `GET https://api.aperion.cc/v1/identity` → **200**
- Without Access:
  - `GET https://api.aperion.cc/v1/identity` → **401**

If you see **500** with “missing CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD”, production Access vars are not set.

### 5.2 WebSocket auth + DO boundary

- With Access session: UI connects to WS and stays connected.
- Without Access session: upgrade must be denied and socket policy-closed with code **1008**.

### 5.3 Web bundle invariants

- CI must pass:
  - `pnpm guard:prod-secrets`
  - `pnpm guard:config-drift`

## 6) Local/CI Config Drift Guardrails

- `pnpm guard:prod-secrets`: scans `apps/web/dist` for forbidden prod token strings.
- `pnpm guard:config-drift`: validates required binding names and required Access var-name contract vs `apps/api-worker/wrangler.toml`, and validates web source uses `VITE_API_BASE_URL` and does not reference `VITE_AUTH_TOKEN`.
