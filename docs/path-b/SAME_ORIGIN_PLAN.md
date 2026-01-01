# Path B — Same-Origin API Mount Plan (Phase 1: Inventory & Truth-Finding)

## Goal

Eliminate browser CORS as a problem class by making the web app call the API on the **same origin** as the frontend:

- Frontend: `https://chat.aperion.cc`
- API (browser-facing): `https://chat.aperion.cc/api/*`
- WebSocket (browser-facing): `wss://chat.aperion.cc/api/...`

Maintain backward compatibility:

- Existing API origin remains supported: `https://api.aperion.cc/*`

Status note (current repo state):

- The Phase 4 implementation work for Path B has landed in the repo (Worker route + conditional `/api/v1/*` rewrite, plus web support for a relative `/api` base).
- Production rollout/validation is still a separate step and is not assumed complete until the Cloudflare routing + deploy steps in `docs/path-b/PHASE_3_MIGRATION.md` have been executed.

---

## Current Reality (Evidence)

### Web: API base URL + REST path construction

- Web API base resolution is centralized in `apps/web/src/lib/apiBaseUrl.ts`:
  - If `VITE_API_BASE_URL` is set, it is used as-is (supports absolute URLs like `https://api.aperion.cc` and relative paths like `/api`).
  - If unset:
    - Dev defaults to `http://127.0.0.1:8787`.
    - Prod defaults to `/api`.
- REST calls are constructed from this resolved base in `apps/web/src/lib/api.ts`.
- The Settings page surfaces the resolved base and provides conditional guidance:
  - If the base is absolute and cross-origin, it may mention CORS.
  - Otherwise it focuses on Access session state.

### Web: WebSocket URL construction

- WebSocket URL construction supports both absolute and relative bases:
  - `apps/web/src/lib/websocket.ts` builds a URL using `new URL()` and then converts `http→ws` / `https→wss`.
- The WebSocket hook uses the same resolved base as REST:
  - `apps/web/src/hooks/useWebSocket.ts` uses `getApiBaseUrl()`.

### Worker: route registration

- The Worker registers REST routes on `/v1/...` and the WebSocket endpoint on `/v1/ws`:
  - `apps/api-worker/src/app.ts`:
    - REST: `router.get("/v1/..." ...)`, `router.post("/v1/..." ...)`, etc.
    - WS: `router.get("/v1/ws", withAuth, ...)`
- Notable existing deviation: there is already a non-`/v1` route:
  - `apps/api-worker/src/app.ts`: `router.post("/api/voice-chat", withAuth, VoiceController.handle);`
  - This may be legacy or experimental; it is relevant for `/api/*` mounting assumptions.

### Worker: auth and path sensitivity

- Auth middleware logs and fingerprints using `new URL(request.url).pathname`:
  - `apps/api-worker/src/middleware/auth.ts`
- Many request-level metrics/labels also record `new URL(request.url).pathname`:
  - `apps/api-worker/src/app.ts` (in the `finally` handler)
- Implication: if we introduce an `/api` prefix, we must decide whether the Worker should **see** `/api/...` or whether the platform config should **strip** it (it won’t by default).

### Worker: current custom domain routing

- Worker is routed for both surfaces in `apps/api-worker/wrangler.toml`:
  - `api.aperion.cc` (custom domain)
  - `chat.aperion.cc/api/*` (Path B mount)
- Repo currently has Wrangler environments `env.test` and `env.preview`, and **no** `env.production` block in `apps/api-worker/wrangler.toml`.

### Docs: current production contract

- Today’s documented production base URL is `https://api.aperion.cc`:
  - `docs/environment-matrix.md`: production `VITE_API_BASE_URL` is `https://api.aperion.cc`.
  - `docs/API_REFERENCE.md`: base URL is `https://api.aperion.cc`.

### Additional Phase 1 sweeps (to reduce “hidden assumption” risk)

- Web source grep for hard-coded URL strings found no additional API/WS origins in runtime code beyond the base-resolution helper (`apiBaseUrl.ts`) and the REST/WS helpers that consume it.
  - A few matches exist only in tests/fixtures and a non-API external link (Cloudflare dashboard).
- Web build config does not define a dev proxy or rewrite for `/api/*`:
  - `apps/web/vite.config.ts` contains no `server.proxy` and no rewrite rules.
  - No `apps/web/wrangler.toml`, `_routes.json`, `netlify.toml`, or similar proxy config exists in the web app folder.
- Non-browser clients and operational tooling do hardcode or default to the current API/WS surfaces:
  - Scripts:
    - `scripts/access-token-diagnose.sh`: `https://api.aperion.cc/v1/identity`
    - `scripts/prod-smoke-interactive.sh`: `API_BASE_URL="https://api.aperion.cc"`
    - `scripts/smoke-ws.mjs`: defaults `WS_URL` to `wss://api.aperion.cc/v1/ws`
    - `scripts/smoke-prod-access-cors.mjs`: defaults to `https://api.aperion.cc/v1/identity` and `https://chat.aperion.cc` for origin/base
  - Devshell commands:
    - Multiple probes/audits default to `https://api.aperion.cc` and assume `/v1/*` paths.
    - Several commands are now surface-aware for Path B prep (defaults unchanged):
      - `./dev access:probe --surface browser` / `--base-url https://chat.aperion.cc/api`
      - `./dev cf:access:audit --surface browser` (checks Access app paths for `/api/v1/*`)
    - `./dev cf:doctor` is read-only and supports overriding expected hostnames (useful for preview/test validation) without changing any routing:
      - `./dev cf:doctor --pages-host chat.aperion.cc --worker-host api.aperion.cc`
    - `devshell/commands/cf_pages_deploy.sh` currently treats `VITE_API_BASE_URL=https://api.aperion.cc` as the expected production value.
  - Tools CLI:
    - `tools/cli` uses `process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787"` (so it is compatible with the same-origin base if you set `VITE_API_BASE_URL=/api` explicitly; otherwise it will default to local dev).
  - Worker OpenAPI generation:
    - `apps/api-worker/scripts/generate-openapi.ts` includes `servers: [{ url: "https://api.aperion.cc" }]`.

---

## Desired End State (Path B)

### Browser-facing API URLs

- REST: browser uses same-origin `fetch("/api/v1/...", { credentials: "include" })` (or an equivalent shared helper)
- WS: browser uses `new WebSocket("wss://chat.aperion.cc/api/v1/ws")` (or relative `new WebSocket(new URL("/api/v1/ws", location.origin).toString().replace(/^http/,"ws"))`)

### Platform routing

Requests to `https://chat.aperion.cc/api/*` are served by the **same Worker** currently behind `api.aperion.cc`.

Compatibility is preserved:

- `https://api.aperion.cc/v1/*` continues to work for non-browser clients, tooling, and backwards compatibility.

---

## Phase 1 Questions (Must Be Answered Before Phases 4–5)

### Q1 — How will `chat.aperion.cc/api/*` be routed to the Worker?

Likely options (to validate in Cloudflare dashboard + deploy tooling):

1. Add a second Worker route: `chat.aperion.cc/api/*` to the existing Worker.
2. Use Pages config (if available) to forward `/api/*` to Worker (less likely unless we add a Pages Function / middleware).

Phase 1 requirement: identify the intended routing mechanism and precedence between Pages and Worker routes for the same hostname.

### Q2 — Will the Worker be updated to understand the `/api` prefix?

Two architectural options:

- **Option A (rewrite in Worker):** Worker accepts both `/v1/*` and `/api/v1/*` by stripping `/api` (or registering both route sets).
- Note: the Worker already has at least one non-`/v1` `/api/*` route (`/api/voice-chat`), so any rewrite must be conditional (e.g. rewrite `/api/v1/*` only) to avoid breaking existing endpoints.
- **Option B (no rewrite):** Ensure platform routing strips `/api` before the Worker sees the request (not typical for Cloudflare route patterns).

Given itty-router currently matches absolute paths like `/v1/...`, we should assume Worker changes are needed unless we deliberately implement a rewrite layer.

### Q3 — Access policy behavior on `chat.aperion.cc/api/*`

- If `chat.aperion.cc` is behind Access, `/api/*` inherits that Access boundary.
- Confirm WebSocket upgrades under the same Access app/policy work as expected.
- Confirm whether any service-token or non-browser workflows need a bypass or should continue using `api.aperion.cc`.

### Q4 — Migration + observability impacts

- Metrics and logs currently record the request pathname; if we add an `/api` prefix, dashboards/alerts may see new paths.
- Decide whether to normalize metrics paths (e.g., strip `/api`) in Worker middleware.

---

## Proposed Phase Breakdown (Docs-First)

### Phase 1 (this doc)

- Inventory all call sites and route definitions (done above).
- Identify open questions and required platform config changes (above).

### Phase 2 (design doc — required before implementation)

See: `docs/path-b/PHASE_2_DESIGN.md`

- Choose the routing mechanism for `/api/*`.
- Specify Worker behavior for `/api` prefix (rewrite vs dual routes).
- Specify Web behavior: whether to support both absolute and relative base URLs, and how to handle WS.
- Specify Access policy updates.

### Phase 3 (migration doc — required before implementation)

See: `docs/path-b/PHASE_3_MIGRATION.md`

- Rollout steps:
  - Configure routing in Cloudflare.
  - Update Worker to accept `/api/*`.
  - Update web to default to same-origin `/api` in production.
  - Keep `api.aperion.cc` working.
- Rollback steps:
  - Revert web to `https://api.aperion.cc` base.
  - Remove `chat.aperion.cc/api/*` routing if needed.

### Phase 4–5 (implementation + rollout)

Blocked until Phase 2–3 docs exist and are approved.

---

## Minimal Acceptance Criteria (for the eventual rollout)

- Browser:
  - `GET https://chat.aperion.cc/api/v1/identity` returns `200` with Access session.
  - WebSocket connects to `wss://chat.aperion.cc/api/v1/ws`.
- Backward compatibility:
  - `GET https://api.aperion.cc/v1/identity` continues to function.
- “CORS” is no longer required for the browser path.
