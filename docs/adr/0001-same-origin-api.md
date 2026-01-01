# ADR 0001: Same-Origin API Mount Under `/api` on `chat.aperion.cc`

## Status

Proposed (Phase 1 deliverable; no behavior changes yet)

## Context

Today the browser calls the API on a separate origin (`https://api.aperion.cc`) configured via the build-time variable `VITE_API_BASE_URL`.

Evidence:

- Web REST calls are constructed as `${VITE_API_BASE_URL}/v1/...`:
  - `apps/web/src/lib/api.ts`
- WebSocket URL is derived from the same base and hardcodes `/v1/ws`:
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
- Likely requires Worker changes because current routes are registered at `/v1/*` and `/v1/ws`.
- May change path strings observed in logs/metrics unless normalized.

### Compatibility

- Non-browser clients and existing tooling can continue using `https://api.aperion.cc`.
- A migration window may exist where both bases are supported.

## Alternatives Considered

1. Continue cross-origin API and “minimize preflights” (e.g., avoid non-simple headers).
   - Helps, but does not remove CORS/Access interactions.
2. Move auth mode away from Access.
   - Not aligned with current production posture.

## Rollout Plan

This ADR is Phase 1 only. Implementation must not begin until Phase 2 and Phase 3 documents exist:

- Phase 2: design decisions (routing mechanism, Worker path handling, WS behavior, Access policy changes)
- Phase 3: migration/rollback plan

## Notes / Open Questions

- Confirm Cloudflare precedence and safe setup for Pages on `chat.aperion.cc` plus Worker routing on `chat.aperion.cc/api/*`.
- Decide whether the Worker should:
  - accept `/api/v1/*` directly (rewrite/dual routes), or
  - remain `/v1/*` only with some platform-level strip (unlikely).
