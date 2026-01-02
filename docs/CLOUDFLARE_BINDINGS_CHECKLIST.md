# Cloudflare Bindings Checklist (Aperion)

> **Status:** Full (canonical)
> \
> **Last updated:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Goal:** Ensure Cloudflare bindings are configured as intended and operational in code.

This repo uses two Cloudflare runtimes:

- **Workers (API)**: `aperion-api-worker` configured in [apps/api-worker/wrangler.toml](apps/api-worker/wrangler.toml)
- **Pages (Web)**: `aperion-chat-private` configured in [wrangler.toml](wrangler.toml)

For names-only “surface map”, see [docs/CLOUDFLARE_SURFACE.md](docs/CLOUDFLARE_SURFACE.md).

## Intended production bindings (API Worker)

From the dashboard screenshot and [apps/api-worker/wrangler.toml](apps/api-worker/wrangler.toml), the production API Worker should have:

- `AI` (Workers AI)
- `BROWSER` (Browser Rendering)
- `CACHE_KV` → KV namespace `APERION_CACHE`
- `CHAT_STATE` → Durable Object class `ChatState`
- `MEDIA_BUCKET` → R2 bucket `aperion-media`
- `MEMORY_DB` → D1 database `aperion-memory`
- `MEMORY_QUEUE` → Queue `aperion-memory-queue` (producer + consumer)
- `MEMORY_VECTORS` → Vectorize index `aperion-vectors`
- `METRICS` → Analytics Engine dataset `aperion_metrics`

Notes:

- Some bindings (e.g. `BROWSER`, `AI`) are “capability bindings” and won’t show a human-friendly resource name in the dashboard.
- Local development does **not** support Vectorize bindings without `--remote`; Wrangler will warn about this.

## Fast preflight (recommended)

These commands are safe and primarily read-only.

1. Verify configuration + intended surfaces (no network required):

- `./dev cf:doctor`

2. Verify configuration (JSON form, good for receipts/logging):

- `./dev cf:doctor --json`

3. Verify worker routing correctness (network gated; read-only):

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:audit --surface api`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:audit --surface browser`

Expected outcome:

- `ORIGIN.OK: yes` and `ORIGIN.SERVED_BY: aperion-api-worker` for both surfaces.

4. Verify worker endpoint responsiveness behind Access (network gated; read-only):

- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke --surface api`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke --surface browser`

Expected outcome:

- Without service token → `302` (Access redirect) is normal.
- With service token → `200` for `/v1/identity`, `/v1/conversations`, `/v1/semantic/search`.

## Checklist: CLI verification by binding

Run from repo root.

### `MEMORY_DB` (D1)

- Config present: `[[d1_databases]] binding = "MEMORY_DB"` in [apps/api-worker/wrangler.toml](apps/api-worker/wrangler.toml)
- Resource exists:
  - `wrangler d1 list`
- Optional deeper checks:
  - `wrangler d1 info aperion-memory` (if supported by your Wrangler version)
  - Confirm migrations apply during deploy (Wrangler output shows “No migrations to apply” when up-to-date)
- Operational signals:
  - API endpoints that depend on D1 should return `200` with Access token:
    - `/v1/identity`, `/v1/conversations`, `/v1/analytics`
  - See smoke runner in [scripts/healthcheck.sh](scripts/healthcheck.sh)

### `CACHE_KV` (Workers KV)

- Config present: `[[kv_namespaces]] binding = "CACHE_KV"`
- Resource exists:
  - `wrangler kv namespace list` (expect a namespace titled `APERION_CACHE`)
- Operational signals:
  - Authentication/Access JWKS caching and related flows should not repeatedly refetch keys.

### `MEDIA_BUCKET` (R2)

- Config present: `[[r2_buckets]] binding = "MEDIA_BUCKET"`
- Resource exists:
  - `wrangler r2 bucket list` (expect `aperion-media`)
- Optional checks:
  - `wrangler r2 object list aperion-media` (read-only)

### `MEMORY_QUEUE` (Queues)

- Config present:
  - `[[queues.producers]] binding = "MEMORY_QUEUE"`
  - `[[queues.consumers]] queue = "aperion-memory-queue"`
- Resource exists:
  - `wrangler queues list` (expect `aperion-memory-queue`)
- Operational signals:
  - Queue-driven features (semantic/insights jobs) should return `status: queued` when queue is enabled.

### `MEMORY_VECTORS` (Vectorize)

- Config present: `[[vectorize]] binding = "MEMORY_VECTORS" index_name = "aperion-vectors"`
- Resource exists:
  - `wrangler vectorize list` (expect `aperion-vectors`)
- Operational signals:
  - `/v1/semantic/search?query=...` should return `200` (with Access token), and not error `Vectorize not configured`.
- Local dev note:
  - Vectorize does not work locally; use `wrangler dev --remote` for true integration.

### `CHAT_STATE` (Durable Object)

- Config present:
  - `[[durable_objects.bindings]] name = "CHAT_STATE" class_name = "ChatState"`
  - `[[migrations]] new_classes = ["ChatState"]`
- Verification:
  - `wrangler -c apps/api-worker/wrangler.toml deploy --dry-run` should list `env.CHAT_STATE (ChatState)`
- Operational signals:
  - WebSocket endpoint `/v1/ws` upgrades (`101`) when authenticated.
  - Use the dedicated WS proof tooling:
    - Node handshake smoke: [scripts/smoke-ws.mjs](scripts/smoke-ws.mjs)
    - Devshell wrapper: `./dev ws:probe` and `./dev ws:proof`

### `AI` (Workers AI)

- Config present: `[ai] binding = "AI"`
- Verification:
  - `wrangler -c apps/api-worker/wrangler.toml deploy --dry-run` lists `env.AI`
  - `wrangler ai --help` to confirm AI tooling availability
- Operational signals:
  - Endpoints/features that generate embeddings or summaries should not error `AI not configured`.

### `BROWSER` (Browser Rendering)

- Config present: `[browser] binding = "BROWSER"`
- Verification:
  - `wrangler -c apps/api-worker/wrangler.toml deploy --dry-run` lists `env.BROWSER`
- Operational signals:
  - PDF rendering uses the binding and will throw `BROWSER binding is not configured` if missing.
  - Rendering implementation lives in [apps/api-worker/src/lib/renderer.ts](apps/api-worker/src/lib/renderer.ts)

### `METRICS` (Analytics Engine dataset)

- Config present: `[[analytics_engine_datasets]] binding = "METRICS" dataset = "aperion_metrics"`
- Verification:
  - `wrangler -c apps/api-worker/wrangler.toml deploy --dry-run` lists `env.METRICS (aperion_metrics)`
  - Wrangler v4.50 does not expose a dedicated `analytics-engine` command; treat deploy output + dashboard as canonical.
- Operational signals:
  - Metrics wrapper degrades gracefully if missing.
  - Implementation: [apps/api-worker/src/lib/metrics.ts](apps/api-worker/src/lib/metrics.ts)

## Secrets checklist (Worker)

The Worker expects key auth settings as _secrets_ (not `[vars]`).

- List configured secret names (safe; network gated):
  - `RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:list`

Required secrets (must be present):

- `APERION_AUTH_MODE`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`

Common optional secrets:

- `CF_ACCESS_SERVICE_TOKEN_ID`
- `CF_ACCESS_SERVICE_TOKEN_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GEMINI_API_KEY`, `GEMINI_MODEL`

See the Env type for the full matrix: [apps/api-worker/src/types.ts](apps/api-worker/src/types.ts)

## Pages bindings (Web)

Pages production bindings are declared in [wrangler.toml](wrangler.toml) and are validated by `./dev cf:doctor`.

Typical bindings for Pages include:

- `CACHE_KV`, `MEMORY_DB`, `MEDIA_BUCKET`, `MEMORY_QUEUE`, `AI`

(These support server-side Pages functions and tooling; the client-side web app primarily uses `VITE_API_BASE_URL` and the Path B `/api` mount.)

## Token permissions

The CI/deploy API token must have enough permission to manage these resources.

See [docs/cloudflare-api-token-permissions.md](docs/cloudflare-api-token-permissions.md).

## What we verified in this workspace (evidence)

Using `wrangler` and the dev shell:

- `wrangler deploy --dry-run` shows the full intended binding set for the API worker.
- `wrangler d1/kv/r2/queues/vectorize` confirms the named resources exist.
- `./dev cf:doctor --json` reports all checks PASS.
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:audit` confirms:
  - `api.aperion.cc` custom domain serves `aperion-api-worker`
  - `chat.aperion.cc/api/*` zone route serves `aperion-api-worker`
- `RUN_NETWORK_TESTS=1 ./dev cf:worker:smoke` confirms Access behavior:
  - unauth → 302 redirect
  - service token → 200 for core endpoints
