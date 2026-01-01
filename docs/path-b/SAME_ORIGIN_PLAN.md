# Path B — Same-Origin API Mount Plan (Phase 1: Inventory & Truth-Finding)

## Goal

Eliminate browser CORS as a problem class by making the web app call the API on the **same origin** as the frontend:

- Frontend: `https://chat.aperion.cc`
- API (browser-facing): `https://chat.aperion.cc/api/*`
- WebSocket (browser-facing): `wss://chat.aperion.cc/api/...`

Maintain backward compatibility:

- Existing API origin remains supported: `https://api.aperion.cc/*`

Phase 1 is **documentation-only**: no client/worker routing behavior changes.

---

## Current Reality (Evidence)

### Web: API base URL + REST path construction

- Web API client defines API base as `VITE_API_BASE_URL` with a local-dev fallback:
  - `apps/web/src/lib/api.ts`:
    - `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";`
    - REST calls are built as `${API_BASE_URL}/v1/...` throughout the exported `api` object.
- The Settings page surfaces the current base URL and instructs about “CORS” today:
  - `apps/web/src/pages/Settings.tsx`:
    - `apiBaseUrl = VITE_API_BASE_URL || "http://127.0.0.1:8787"`
    - Auth self-test text includes “Confirm CORS for {apiBaseUrl}” and “Checking /v1/identity…”.

### Web: WebSocket URL construction

- WebSocket URL is derived by converting HTTP base to WS and appending a hard-coded path:
  - `apps/web/src/lib/websocket.ts`:
    - `const wsUrl = baseUrl.replace(/^http/, "ws") + "/v1/ws";`
- Hook uses the same `VITE_API_BASE_URL` fallback to initialize the WebSocket:
  - `apps/web/src/hooks/useWebSocket.ts`:
    - `API_BASE_URL = VITE_API_BASE_URL || "http://127.0.0.1:8787"`

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

- Worker is currently routed as a custom domain on `api.aperion.cc`:
  - `apps/api-worker/wrangler.toml`:
    - `routes = [{ pattern = "api.aperion.cc", custom_domain = true, zone_name = "aperion.cc" }]`
- Repo currently has Wrangler environments `env.test` and `env.preview`, and **no** `env.production` block in `apps/api-worker/wrangler.toml`.

### Docs: current production contract

- Today’s documented production base URL is `https://api.aperion.cc`:
  - `docs/environment-matrix.md`: production `VITE_API_BASE_URL` is `https://api.aperion.cc`.
  - `docs/API_REFERENCE.md`: base URL is `https://api.aperion.cc`.

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

- Choose the routing mechanism for `/api/*`.
- Specify Worker behavior for `/api` prefix (rewrite vs dual routes).
- Specify Web behavior: whether to support both absolute and relative base URLs, and how to handle WS.
- Specify Access policy updates.

### Phase 3 (migration doc — required before implementation)

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
