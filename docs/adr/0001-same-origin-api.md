# ADR 0001: Same-Origin API Mount Under `/api` on `chat.aperion.cc`

## Status

Accepted; implementation landed in repo (Phase 4). Production rollout/validation is still pending.

## Context

Today production browser builds typically call the API on a separate origin (`https://api.aperion.cc`) via the build-time variable `VITE_API_BASE_URL`.

The repo now also supports a same-origin base (`/api`) for the browser, but this must not be assumed live until Cloudflare routing is deployed/validated.

Evidence:

- Web API base is resolved in `apps/web/src/lib/apiBaseUrl.ts`:
  - Uses `VITE_API_BASE_URL` if set (absolute or relative `/api`).
  - If unset: dev defaults to `http://127.0.0.1:8787`, prod defaults to `/api`.
- Web REST calls and WebSocket URL construction consume that resolved base:
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/lib/websocket.ts`
- Production docs describe `VITE_API_BASE_URL=https://api.aperion.cc`:
  - `docs/environment-matrix.md`

This creates an ongoing class of failure modes and operational complexity for browser traffic:

- CORS preflights, redirects, and header constraints interact poorly with Access boundaries.
- Preview/staging origins require additional allow-lists.
- Diagnosing “is this Access, is this Worker, is this origin?” becomes harder than necessary.

## Decision

Move browser-facing API traffic to the same origin as the frontend by mounting the API at:

- `https://chat.aperion.cc/api/*`

with WebSockets at:

- `wss://chat.aperion.cc/api/...`

The existing API origin remains supported for backward compatibility:

- `https://api.aperion.cc/*`

## Consequences

### Positive

- Eliminates CORS as a problem class for normal browser operation.
- Aligns authentication boundary: browser session cookies apply to frontend and API under one origin.
- Simplifies production/preview behavior and reduces allow-list churn.

### Negative / Costs

- Requires Cloudflare routing configuration so that `chat.aperion.cc/api/*` is served by the Worker.
- Requires Worker changes because current routes are registered at `/v1/*` and `/v1/ws`.
- May change path strings observed in logs/metrics unless normalized.

Note: in the current implementation, the Worker rewrites `/api/v1/*` to `/v1/*` by constructing a new `Request` before routing, so request-level logging/metrics that read `new URL(request.url).pathname` observe normalized `/v1/*`.

### Compatibility

- Non-browser clients and existing tooling can continue using `https://api.aperion.cc`.
- A migration window may exist where both bases are supported.

## Alternatives Considered

1. Continue cross-origin API and “minimize preflights” (e.g., avoid non-simple headers).
   - Helps, but does not remove CORS/Access interactions.
2. Move auth mode away from Access.
   - Not aligned with current production posture.

## Rollout Plan

Phase 2/3 documents exist and Phase 4 implementation has landed. Remaining work is operational rollout/validation:

- Phase 3: execute the rollout/rollback plan

## Notes / Open Questions

- Confirm Cloudflare precedence and safe setup for Pages on `chat.aperion.cc` plus Worker routing on `chat.aperion.cc/api/*`.
- Decide whether the Worker should:
  - accept `/api/v1/*` directly (rewrite/dual routes; rewrite must be conditional and must not break existing non-`/v1` `/api/*` routes such as `/api/voice-chat`), or
  - remain `/v1/*` only with some platform-level strip (unlikely).
