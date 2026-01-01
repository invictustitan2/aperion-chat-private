# Path B — Phase 2 Design: Same-Origin `/api` Mount on `chat.aperion.cc`

Status: Design complete; Phase 4 implementation has landed in repo. Production rollout/validation remains pending.

This design is based on Phase 1 inventory in `docs/path-b/SAME_ORIGIN_PLAN.md` and ADR 0001 (`docs/adr/0001-same-origin-api.md`).

---

## Goals

- Eliminate browser CORS as a problem class by serving browser API traffic from the same origin as the frontend.
- Preserve backward compatibility for non-browser clients by keeping `https://api.aperion.cc/*` working.
- Keep operational tooling safe-by-default (no secrets printed; network gated).

Non-goals (Phase 2):

- Implementing the changes (Phase 4–5).
- Redesigning authentication away from Cloudflare Access.

---

## Target Contract

### Browser-facing surface (Path B)

- REST: `https://chat.aperion.cc/api/v1/*`
- WS: `wss://chat.aperion.cc/api/v1/ws`

### Backward-compatible surface

- REST: `https://api.aperion.cc/v1/*`
- WS: `wss://api.aperion.cc/v1/ws`

---

## Design Decisions

### D1 — Routing mechanism for `chat.aperion.cc/api/*`

Decision: Add an additional Worker route mapping `chat.aperion.cc/api/*` to the existing Worker.

Rationale:

- Minimal moving parts: no Pages Functions proxy layer required.
- Keeps the Worker as the single source of truth for API routing and WebSocket upgrades.

Operational notes:

- This introduces a hostname + path pattern that overlaps with Pages content on `chat.aperion.cc`.
- Phase 3 must explicitly validate precedence and any required Cloudflare dashboard configuration.

### D2 — Worker path handling for `/api` prefix

Decision: Update the Worker to accept the `/api` mount by normalizing the incoming request path:

- If the request path starts with `/api/v1/` (or equals `/api/v1/ws`), strip the leading `/api` before itty-router matching.
- Continue to accept existing `/v1/*` paths unchanged.

Rationale:

- Cloudflare route patterns do not “strip” path prefixes by default.
- Today the Worker registers routes like `/v1/...` and `/v1/ws`.
- Normalizing once at the top avoids duplicating route definitions.

Constraints / invariants:

- A request to `/api/v1/ws` must reach the same handler as `/v1/ws`.
- A request to `/api/voice-chat` must continue to function (note: this currently exists and is already under `/api/*`, so rewriting must be conditional and not apply to all `/api/*`).

### D3 — Metrics/logging normalization

Decision: Preserve observability continuity by recording a normalized path for metrics/logging:

- When applying the `/api/v1/*` → `/v1/*` rewrite, record metrics/logging using the rewritten path (without the `/api` prefix).

Rationale:

- Dashboards/alerts keyed on path should not double-count due to the new prefix.

Implementation note: the current implementation rewrites `/api/v1/*` requests to `/v1/*` by constructing a new `Request` before routing, so request-level logging/metrics that read `new URL(request.url).pathname` naturally observe the normalized path.

Note: this is an internal normalization only; the external HTTP interface still supports both.

---

## Implementation Status (repo)

- D1: Worker route for `chat.aperion.cc/api/*` is present in `apps/api-worker/wrangler.toml`.
- D2: Worker conditional rewrite for `/api/v1/*` is implemented in `apps/api-worker/src/app.ts`.
- D4/D5: Web API base resolution + WS URL construction support absolute and relative bases (`/api`) via `apps/web/src/lib/apiBaseUrl.ts` and `apps/web/src/lib/websocket.ts`.
- D6: Access policy behavior for `chat.aperion.cc/api/*` is still a rollout-time verification item.

### D4 — Web app API base behavior

Decision: In production builds for the browser, use a relative base of `/api`.

Implementation shape (Phase 4):

- Treat `VITE_API_BASE_URL` as optional. If it is an absolute URL (`http(s)://...`), use it.
- Otherwise, prefer a relative base path (`/api`) for production.
- For local dev, continue to support the existing fallback (`http://127.0.0.1:8787`).

Constraints:

- The current WebSocket URL builder assumes an absolute `http(s)` base and does `replace(/^http/, "ws") + "/v1/ws"`.
- Phase 4 must update the WS helper to correctly construct WS URLs for both absolute and relative bases.

### D5 — WebSocket URL construction

Decision: Construct WebSocket URL using URL semantics rather than string replacement.

Preferred approach (Phase 4):

- Build an HTTP URL first using `new URL(path, base)`.
- Convert scheme `http→ws` and `https→wss`.

This must support:

- Absolute base (`https://api.aperion.cc`) → `wss://api.aperion.cc/v1/ws`
- Relative base (`/api`) on `https://chat.aperion.cc` → `wss://chat.aperion.cc/api/v1/ws`

### D6 — Cloudflare Access policy / boundary

Decision: `chat.aperion.cc/api/*` is governed by Access policy consistent with the browser session model.

Requirements:

- Browser session cookies should grant access to `GET /api/v1/identity`.
- WebSocket upgrade to `/api/v1/ws` must work under the same Access posture.

Compatibility:

- Service-token automation should continue to use `api.aperion.cc` unless explicitly migrated.
- Devshell remains capable of auditing both “external” and “browser” surfaces.

---

## Verification Strategy (using devshell)

These are _verification steps_ (Phase 3/4) that inform what we must configure.

- Access app/policy inventory:
  - `./dev cf:access:audit` (current)
  - `./dev cf:access:audit --surface browser` (Path B target: checks for `/api/v1/*` coverage)
- Worker surface smoke/probes (network gated):
  - `RUN_NETWORK_TESTS=1 ./dev access:probe` (current)
  - `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser` (Path B target)

---

## Open Questions (must be resolved during Phase 3)

- Does Cloudflare route precedence behave as expected when Pages serves `chat.aperion.cc` and the Worker is additionally routed for `chat.aperion.cc/api/*`?
- Do WebSocket upgrades under Access for the `/api/v1/ws` path behave identically to `/v1/ws` on `api.aperion.cc`?
- Do any Access policies need explicit path coverage updates (e.g. `/api/v1/*` vs `/v1/*`)?

---

## Acceptance Criteria (Phase 2)

- The design fully specifies:
  - Routing mechanism for `chat.aperion.cc/api/*`
  - Worker path normalization behavior
  - Web REST + WS construction behavior
  - Access boundary expectations
  - Observability normalization policy
- Phase 3 migration/rollback plan can be written directly from this design.
