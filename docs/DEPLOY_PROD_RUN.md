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

- `pnpm -s run verify:devshell`
- `pnpm -s test:node`

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

Recommended (CLI): one command, receipts-first

- `RUN_NETWORK_TESTS=1 ./dev deploy:prod`

This orchestrates:

- Preflight gates
- Pre-deploy evidence (Worker secrets/list, smoke, access probe, access audit)
- Worker deploy + Pages deploy (using the safe wrappers)
- Post-deploy validation
- A strict summary file at:
  - `receipts/deploy/<YYYY-MM-DD>/<HHMMSS>/SUMMARY.txt`

Receipts:

- The receipts directory is printed as `RECEIPTS.DIR: ...`.
- The most recent run is recorded at `receipts/deploy/latest.txt`.

Preferred deploy commands (deterministic wrappers)

- Worker deploy (env-aware; rejects invalid env; network-gated):
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy [--env <name>]`
  - Valid env names are those listed under `[env.*]` in `apps/api-worker/wrangler.toml`.

- Pages deploy (build-var safe; refuses non-prod base URL unless `--force`; network-gated):
  - `RUN_NETWORK_TESTS=1 ./dev cf:pages:deploy [--force]`

Quick post-deploy check:

- `RUN_NETWORK_TESTS=1 ./dev deploy:validate`

Raw `wrangler` commands remain available as a fallback, but the wrappers prevent silent env drift and enforce the repo’s safety rails.

Operator sequence (CLI, repo-grounded)

0. Choose Wrangler environment (Worker only)

Wrangler can have multiple environments under `apps/api-worker/wrangler.toml`.

- If `apps/api-worker/wrangler.toml` defines `[env.production]`, then production deploys should consistently target it:
  - `export APERION_WRANGLER_ENV=production`
  - and pass `--env production` on all Worker-related CLI commands.

- If there is no `[env.production]` (current repo state), production uses the top-level config and the effective env is `none`.
  - Do not pass `--env` for production.
  - Use `--env preview` / `--env test` only when you intentionally target those.

Wrangler env selection safety

- You can always see which Wrangler envs exist in `apps/api-worker/wrangler.toml` without enabling network calls:
  - `./dev cf:worker:secrets:list`
  - This prints:
    - `WRANGLER.ENV.AVAILABLE: <csv|none>`
    - `WRANGLER.ENV.VALID: <yes|no>` (based on `--env` / `APERION_WRANGLER_ENV`)
- If you pass an invalid env name:
  - `cf:worker:secrets:list` rejects it once `RUN_NETWORK_TESTS=1` is enabled (before any Wrangler call).
  - `cf:worker:secrets:apply` rejects it immediately (before any Wrangler call), and still refuses without a TTY.

1. Preflight gates:

- `pnpm -s run verify:devshell`
- `pnpm -s test:node`

2. Confirm Worker secrets are present (names only; network opt-in):

- Production (no `[env.production]`):
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:list`

- If you are using `[env.production]`:
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:list --env production`

If missing, set them (interactive; TTY required; never prints values):

- Production (no `[env.production]`):
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:apply`

- If you are using `[env.production]`:
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:apply --env production`

3. Deploy Worker (from `apps/api-worker/`):

- Production (no `[env.production]`):
- Production (no `[env.production]`):
  - Preferred: `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy`
  - Fallback: `cd apps/api-worker && npx wrangler deploy`

- If you are using `[env.production]`:
- If you are using `[env.production]`:
  - Preferred: `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy --env production`
  - Fallback: `cd apps/api-worker && npx wrangler deploy --env production`

4. Post-deploy API receipts:

- `RUN_NETWORK_TESTS=1 ./dev access:probe`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke`

5. Only then deploy Pages and validate UI → API calls.

### 3.1 Deploy API Worker

- Production (no `[env.production]`): preferred `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy` (fallback: `cd apps/api-worker && npx wrangler deploy`)
- If you are using `[env.production]`: preferred `RUN_NETWORK_TESTS=1 ./dev cf:worker:deploy --env production` (fallback: `cd apps/api-worker && npx wrangler deploy --env production`)

### 3.2 Deploy Pages

- Preferred: `RUN_NETWORK_TESTS=1 ./dev cf:pages:deploy`
- Fallback: `cd apps/web && pnpm build && npx wrangler pages deploy dist --project-name aperion-chat-private`

Note: Pages deploy is separate from Wrangler Worker environments.

Receipts guidance (CLI deploys)

- Capture logs under `receipts/deploy/<date>/<time>/` and store only command outputs and paths (never secret values).

## 4) Post-deploy smoke tests

### 4.1 HTTP (Access boundary)

Without an Access service token (expected: protected):

- `curl -i https://api.aperion.cc/v1/identity`
  - Expected: not `200` (commonly `302` or `403` from Access, or `401` if Access allows through but Worker denies)

With an Access service token (expected: `200`):

```bash
cat <<EOF | curl -i -K -
url = "https://api.aperion.cc/v1/identity"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
```

### 4.1.1 Diagnosing `302` with a service token

If a request _with_ `CF-Access-Client-Id` / `CF-Access-Client-Secret` still returns `302`, Cloudflare Access rejected the service token for this application/hostname/path.

#### Status Code Truth Table (API)

| Request            |      Status | What it implies                                                                                                                                                                |
| ------------------ | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No service token   |       `302` | Access intercepted and redirected to login (common default).                                                                                                                   |
| No service token   |       `403` | Access intercepted and denied (policy deny / no session).                                                                                                                      |
| No service token   |       `401` | Request reached Worker, and Worker denied (missing Access assertion / bearer).                                                                                                 |
| With service token |       `302` | Access did **not** accept service auth for this hostname/path (missing SERVICE_AUTH policy, path mismatch, wrong token association, or Access set to redirect instead of 401). |
| With service token | `401`/`403` | Request reached Access/Worker but was denied (token mismatch, policy mismatch, or Worker fail-closed).                                                                         |
| With service token |       `404` | Service token likely accepted, but either (a) you probed with the wrong HTTP method (e.g., `HEAD` when only `GET` is routed), or (b) the origin does not serve that path.      |
| With service token |       `200` | Service auth succeeded end-to-end.                                                                                                                                             |

Notes:

- A `302` for service auth is almost always an Access configuration issue, not a Worker bug.
- If you enable “Return 401 Response for Service Auth policies”, service-auth failures become `401` instead of `302` redirects.
- When checking whether an endpoint exists, always use `GET`. Some Workers return `404` to `HEAD` even when `GET` is routed.

#### Operator sequence (fastest path to resolve 302)

1. Audit Access configuration (evidence, not vibes):

- `./dev cf:access:audit`

2. Probe API behavior with and without service token headers:

- `RUN_NETWORK_TESTS=1 ./dev access:probe`

2b. If service-token requests return `404`, audit Worker binding for the hostname:

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:audit`

2c. Confirm required Worker auth-mode inputs are present (these control Access JWT validation in prod):

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:list`

If missing, set them interactively (TTY required; never prints values):

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:apply`

Then deploy the Worker:

- `cd apps/api-worker && npx wrangler deploy`

Post-deploy receipts:

- `RUN_NETWORK_TESTS=1 ./dev access:probe`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke`

3. Confirm requests are reaching origin when appropriate:

- `wrangler tail --name aperion-api-worker`

  You should see requests when Access allows through and the Worker is receiving traffic.

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

Note: Any browser-visible custom headers must be namespaced under `X-Aperion-*` to remain compatible with strict credentialed CORS preflight.

#### 4.2.1 Access bypass for static assets (recommended)

Browsers fetch some assets (PWA manifest + icons, favicon) very early and may do so before an Access session exists.
If these requests get redirected to Access, you can see noisy console errors and failed PWA installs.

In Cloudflare Zero Trust, add an Access policy (or separate Access application) to bypass Access for these exact paths on `https://chat.aperion.cc`:

- `/manifest.json`
- `/icon-192.png`
- `/icon-512.png`
- `/favicon.ico`

Keep the main application routes protected by Access.

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
