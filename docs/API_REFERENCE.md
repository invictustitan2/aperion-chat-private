# API Reference

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev + Operator
> \
> **Canonical for:** HTTP API surface of the API Worker

This document describes the HTTP API implemented by the API Worker.

Source of truth for routes: `apps/api-worker/src/app.ts`.

## Base URLs

Same-origin mount (browser / “Path B”):

- The browser calls `https://chat.aperion.cc/api/v1/*`.
- The Worker rewrites `/api/v1/*` to `/v1/*` (and does not rewrite other `/api/*` paths).

Direct Worker origin:

- `https://api.aperion.cc/v1/*`

Local dev:

- `http://127.0.0.1:8787/v1/*`

## Authentication

All endpoints listed below are wrapped with the `withAuth` middleware.

Auth details (Cloudflare Access, service tokens, dev modes) live in:

- `docs/authentication-setup.md`
- `docs/auth-debugging.md`

## Response headers

For non-WebSocket responses, the Worker may attach:

- `X-Aperion-Trace-Id`
- `X-Aperion-Auth-Fingerprint`

## Endpoints

### Chat

**POST** `/v1/chat`

- Body: JSON validated by `ChatRequestSchema` (`apps/api-worker/src/lib/schemas.ts`)
- Response (JSON):

```json
{
  "id": "<uuid>",
  "response": "...",
  "timestamp": 1730000000000,
  "usedMemories": [
    { "type": "semantic", "id": "...", "score": 0.12, "excerpt": "..." }
  ]
}
```

**POST** `/v1/chat/stream`

- Body: JSON validated by `ChatRequestSchema`
- Response: Server-Sent Events (`Content-Type: text/event-stream`)
- Event payloads:
  - Optional first event: `data: {"meta":{"derived_from":["<semantic-id>"]}}`
  - Token events: `data: {"token":"..."}`
  - Completion: `data: [DONE]`

**POST** `/v1/chat/export`

- Body (JSON): `{ "html": "<html>..." }`
- Response: PDF (`Content-Type: application/pdf`) with `Content-Disposition: attachment; filename="chat-export-<timestamp>.pdf"`

**POST** `/v1/chat/analyze`

- Request: `multipart/form-data`
  - `image`: File (required)
  - `prompt`: string (optional)
- Response (JSON):

```json
{ "success": true, "analysis": "...", "timestamp": 1730000000000 }
```

### Conversations

**GET** `/v1/conversations?limit=50&since=0`

- Response (JSON):

```json
[
  {
    "id": "<uuid>",
    "title": "New Conversation",
    "createdAt": 1730000000000,
    "updatedAt": 1730000000000,
    "metadata": null
  }
]
```

**POST** `/v1/conversations`

- Body (JSON): `{ "title"?: string }`
- Response: `201` with a `ConversationRecord`

**PUT** `/v1/conversations/:id`

- Body (JSON): `{ "title": string }`
- Response (JSON): `{ "success": true, "id": "...", "title": "..." }`

**DELETE** `/v1/conversations/:id`

- Response (JSON): `{ "success": true, "id": "..." }`

### Preferences

Preferences keys are allow-listed by `apps/api-worker/src/lib/preferencesRegistry.ts`.

- `ai.tone`: string (`default` | `concise` | `detailed`)
- `theme`: string (`dark` | `light` | `system`)

**GET** `/v1/preferences/:key`

- Unknown keys return `404`.
- If the key is known but not set, the Worker returns the default value with `isDefault: true`.
- Response shape:

```json
{ "key": "theme", "value": "dark", "updatedAt": 0, "isDefault": true }
```

**PUT** `/v1/preferences/:key`

- Body (JSON): `{ "value": <any> }`
- Response shape:

```json
{
  "key": "theme",
  "value": "light",
  "updatedAt": 1730000000000,
  "isDefault": false
}
```

### Analytics

**GET** `/v1/analytics?days=<number>`

- Query: `days` is validated as a positive number (string in the query).
- Response (JSON): `AnalyticsDashboardResponse` from `apps/api-worker/src/services/AnalyticsService.ts`
- Response headers include: `Cache-Control: private, max-age=10`

### Insights

**POST** `/v1/insights/summary`

- Body: JSON validated by `InsightsSummarySchema`
- Response (normalized by controller):

Queued:

```json
{ "success": true, "status": "queued", "jobId": "<uuid>", "sources": [] }
```

Completed:

```json
{ "success": true, "status": "completed", "summary": "...", "sources": [] }
```

### Episodic

**POST** `/v1/episodic`

- Body: JSON validated by `EpisodicRequestSchema`
- Response:
  - `200` if written synchronously
  - `202` if queued via `MEMORY_QUEUE`

```json
{
  "success": true,
  "id": "<uuid>",
  "receipt": { "decision": "allow" },
  "status": "written"
}
```

**GET** `/v1/episodic?limit=50&since=0&conversation_id=<id>`

- Response: array of episodic records
- Response headers include: `Cache-Control: private, max-age=5`

**PUT** `/v1/episodic/:id`

- Body: JSON validated by `EpisodicUpdateSchema` (`content?`, `tags?`, `importance?`; at least one required)
- Response (JSON): `{ "success": true, "id": "...", "status": "updated" | "noop" }`

**DELETE** `/v1/episodic?confirm=true`

- Response (JSON): `{ "success": true, "message": "Episodic memory cleared" }`

### Semantic

**POST** `/v1/semantic`

- Body: JSON validated by `SemanticRequestSchema`
- Response:
  - `200` if written synchronously
  - `202` if queued via `MEMORY_QUEUE`

```json
{
  "success": true,
  "id": "<uuid>",
  "receipt": { "decision": "allow" },
  "status": "written"
}
```

**GET** `/v1/semantic/search?query=<string>&limit=5`

- Response: array of semantic records with `score`

**GET** `/v1/semantic/hybrid?query=<string>&limit=10`

- Response: array of hybrid results (combined keyword + semantic)

**POST** `/v1/semantic/summarize`

- Body: JSON validated by `SemanticSummarizeSchema`
- Response:
  - `202`: `{ "success": true, "jobId": "...", "status": "queued" }`
  - `200`: `{ "summary": "..." }`

### Knowledge

**GET** `/v1/knowledge?limit=50&since=0&q=<string>`

- Response: array of `KnowledgeRecord` from `apps/api-worker/src/services/KnowledgeService.ts`

**POST** `/v1/knowledge/promote`

- Body: JSON validated by `KnowledgePromoteSchema` (`{ "semantic_id": "..." }`)
- Response: `201` with `{ "success": true, "record": <KnowledgeRecord> }`

### Relationships

**GET** `/v1/relationships?kind=<kind>&id=<id>&limit=50&since=0`

- Query validated by `RelationshipListQuerySchema`
- Response: array of `RelationshipRecord` from `apps/api-worker/src/services/RelationshipsService.ts`

**POST** `/v1/relationships`

- Body validated by `RelationshipCreateSchema`
- Response: `201` with `{ "success": true, "relationship": <RelationshipRecord> }`

### Identity

**POST** `/v1/identity`

- Body: JSON validated by `IdentityUpsertSchema`
- Response (JSON): `{ "success": true, "id": "<uuid>", "receipt": { "decision": "allow" } }`

**GET** `/v1/identity`

- Response: array of identity rows (see `IdentityService.getAll()`)

### Voice

The same handler is exposed at both:

- **POST** `/v1/voice-chat`
- **POST** `/api/voice-chat` (note: this path is intentionally _not_ part of the `/api/v1` rewrite)

Request: `multipart/form-data`

- `audio`: File (required)
- `conversation_id`: string (optional)

Response (JSON):

```json
{
  "userText": "...",
  "assistantText": "...",
  "audio": "<base64 or empty>",
  "episodicId": "<uuid>",
  "useFrontendTts": true,
  "source": "workers-ai"
}
```

### WebSocket

**GET** `/v1/ws`

- Proxies the WebSocket upgrade to a Durable Object (`env.CHAT_STATE`).
- Returns `503` if `CHAT_STATE` is not configured.

### Media

**PUT** `/v1/media/:key`

- Body: raw bytes streamed to R2 (`env.MEDIA_BUCKET`)
- Response (JSON): `{ "success": true, "key": "..." }`
- Returns `503` if R2 is not configured.

**GET** `/v1/media/:key`

- Response: object bytes streamed from R2
- Headers include: `Cache-Control: public, max-age=31536000, immutable` and `etag`

### Runbooks

**POST** `/v1/runbooks/hash`

- Body: raw text
- Response (JSON): `{ "taskId": "..." }`

### Receipts

**GET** `/v1/receipts`

- Response: list of last 50 receipts

```json
[
  {
    "id": "<uuid>",
    "timestamp": 1730000000000,
    "action": "memory_write",
    "allowed": true,
    "reason": "..."
  }
]
```

### Jobs

**GET** `/v1/jobs/:id`

- Response:

```json
{
  "id": "...",
  "type": "summarize",
  "status": "queued",
  "createdAt": 1730000000000,
  "updatedAt": 1730000000000,
  "result": null,
  "error": null
}
```

If `job.output` is valid JSON, the controller returns it parsed under `result`; otherwise it returns the raw string.

### Logs

**GET** `/v1/logs?limit=100`

- Response: array of log rows `{ id, timestamp, level, message, stack_trace, metadata, source }`

**POST** `/v1/logs`

- Body (JSON): `{ "level": string, "message": string, "source"?: string, "metadata"?: string, "stack_trace"?: string }`
- Response: `201` with `{ "success": true, "id": "..." }`

**DELETE** `/v1/logs`

- Response: `{ "success": true, "deleted": <number> }`

## OpenAPI (partial)

There is a generator script at `apps/api-worker/scripts/generate-openapi.ts` which writes `docs/openapi.json`.

Run:

```sh
pnpm -C apps/api-worker docs:generate
```

The generator currently registers only a subset of endpoints and schemas.
