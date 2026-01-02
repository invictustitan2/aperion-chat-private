# Architecture

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** High-level system map (implemented components only)

This document describes the architecture that is directly supported by code/config in this repository.

Evidence anchors:

- Worker entrypoints: `apps/api-worker/src/index.ts`
- Worker HTTP routes: `apps/api-worker/src/app.ts`
- Cloudflare bindings/routes: `apps/api-worker/wrangler.toml`
- Web API base default: `apps/web/src/lib/apiBaseUrl.ts`

## Surfaces

- **Web app (Cloudflare Pages):** `https://chat.aperion.cc`
- **API Worker (Cloudflare Workers):**
  - Custom domain: `https://api.aperion.cc`
  - Same-origin Path B mount (browser contract): `https://chat.aperion.cc/api/*`

Evidence: `apps/api-worker/wrangler.toml` routes + `apps/web/src/lib/apiBaseUrl.ts`.

## Major components

### Web (`apps/web`)

- Browser client computes an API base URL as:
  - If `VITE_API_BASE_URL` is set, it uses that (absolute URL or relative path like `/api`).
  - Otherwise, it defaults to `/api` in production builds and `http://127.0.0.1:8787` in dev.

Evidence: `apps/web/src/lib/apiBaseUrl.ts`.

### API Worker (`apps/api-worker`)

The Worker has three runtime entrypoints:

- `fetch`: HTTP API (routes in `apps/api-worker/src/app.ts`).
- `queue`: processes memory batches via `processMemoryBatch`.
- `scheduled`: housekeeping tasks (logs cleanup + rate limit cleanup).

Evidence: `apps/api-worker/src/index.ts`.

The HTTP layer uses an itty-router pipeline with:

- `withContext` (trace id, logger, metrics, timing)
- `withAuth` (Access/service-token/legacy-token auth)
- `finally` hook for response headers (CORS + trace headers) and metrics recording

Evidence: `apps/api-worker/src/middleware/context.ts`, `apps/api-worker/src/middleware/auth.ts`, `apps/api-worker/src/app.ts`.

### Real-time (WebSocket)

- `GET /v1/ws` is authenticated and forwarded to the Durable Object `ChatState`.
- The Durable Object re-verifies auth and fails closed for WS upgrades.

Evidence: `apps/api-worker/src/app.ts` (`/v1/ws`) + `apps/api-worker/src/do/ChatState.ts`.

## Data stores & bindings (as implemented)

Bindings are defined in `apps/api-worker/wrangler.toml` and used by various endpoints.

- **D1 (`MEMORY_DB`)**: primary persistence for memory tables, receipts, logs.
  - Evidence: `apps/api-worker/src/services/EpisodicService.ts` (writes receipts + episodic), `apps/api-worker/src/controllers/ReceiptsController.ts`.
- **Durable Objects (`CHAT_STATE`)**: WebSocket session fanout.
  - Evidence: `apps/api-worker/src/do/ChatState.ts`.
- **Queues (`MEMORY_QUEUE`)**: optional async writes for episodic/semantic flows.
  - Evidence: `apps/api-worker/src/services/EpisodicService.ts`, `apps/api-worker/src/services/SemanticService.ts`.
- **R2 (`MEDIA_BUCKET`)**: media upload/download endpoints; returns `503` if missing.
  - Evidence: `apps/api-worker/src/controllers/MediaController.ts`.
- **Workers AI (`AI`)**: used for embeddings/summarization when configured.
  - Evidence: `apps/api-worker/src/services/SemanticService.ts`.
- **Vectorize (`MEMORY_VECTORS`)**: optional vector indexing; in test or when missing, the vector store becomes a no-op.
  - Evidence: `apps/api-worker/src/lib/vectorStore.ts`.

## Packages

- `packages/memory-core`: shared memory record types used by both web/worker.
- `packages/policy`: policy gates that emit receipts for memory writes.
- `packages/shared`: shared helpers (e.g., hashing).

Evidence: Worker imports (`apps/api-worker/src/services/*`) and package exports (`packages/policy/src/index.ts`).
