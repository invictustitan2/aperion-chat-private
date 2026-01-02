# API Reference

This document describes the **HTTP API surface** (paths under `/v1/*`) implemented by the API Worker.

Path B note (same-origin API):

- Browser contract (production default): same-origin `https://chat.aperion.cc/api/v1/*` (no CORS).
- Back-compat / tooling contract: `https://api.aperion.cc/v1/*` remains supported.
- Source of truth for acceptance criteria: `docs/path-b/PHASE_3_MIGRATION.md`.

**Base URL (browser / Path B)**: `https://chat.aperion.cc/api`

**Base URL (external clients / back-compat)**: `https://api.aperion.cc`

**Base URL (local)**: `http://127.0.0.1:8787`

## Authentication

The Worker supports multiple auth modes, but production is expected to be protected by Cloudflare Access.

### Cloudflare Access (production)

Requests succeed when the caller has a valid Cloudflare Access session (browser cookies) or uses a service token (for automation).

### Legacy bearer token (dev/test / token or hybrid modes)

In token/hybrid modes, requests include an `Authorization` header:

```http
Authorization: Bearer <API_TOKEN>
```

## Endpoints

### 1. Chat Completion

**POST** `/v1/chat`

Generate a response from the AI assistant. Supports context history and optional execution of tools (Workers AI only).

**Body Schema (`ChatRequestSchema`)**

```json
{
  "message": "Hello world",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ],
  "model": "workers-ai" // Optional: "workers-ai" | "gemini"
}
```

**Response**

```json
{
  "id": "uuid",
  "response": "Hello! How can I help you?",
  "timestamp": 1234567890
}
```

### 2. Episodic Memory

**POST** `/v1/episodic`

Manually insert an episodic memory (e.g., from voice transcription).

**Body Schema (`EpisodicRequestSchema`)**

```json
{
  "content": "User mentioned they like apples.",
  "provenance": {
    "source_type": "user",
    "source_id": "operator",
    "timestamp": 1234567890
  }
}
```

**GET** `/v1/episodic?limit=50&since=0`

Retrieve a list of episodic memories.

### 3. Semantic Memory

**POST** `/v1/semantic`

Store knowledge with vector embeddings.

**Body Schema (`SemanticRequestSchema`)**

```json
{
  "content": "Apples are a fruit.",
  "references": ["wiki/apples"],
  "provenance": { ... }
}
```

**GET** `/v1/semantic/search?query=fruit&limit=5`

Search semantic memory using vector similarity.

**POST** `/v1/semantic/summarize`

Summarize a list of text contents.

```json
{
  "contents": ["Text 1", "Text 2"],
  "query": "Optional focus query"
}
```

### 4. Identity

**POST** `/v1/identity`

Update a user preference or identity trait.

**Body Schema (`IdentityUpsertSchema`)**

```json
{
  "key": "preferred_tone",
  "value": "formal",
  "provenance": { ... }
}
```

**GET** `/v1/identity`

Retrieve all identity records.

### 5. Voice

**POST** `/v1/voice-chat`

Compatibility: the Worker also exposes the same handler at **POST** `/api/voice-chat`.

Multipart form handling for audio input. Returns STT, AI Response, and TTS audio.

- **Form Field**: `audio` (File)
- **Response**: JSON with base64 audio and transcripts.

### 6. Observability

**GET** `/v1/receipts`

List audit logs (receipts) of memory write operations.

## Error Handling

Standard HTTP status codes are used:

- `200/201`: Success
- `400`: Bad Request (Validation failed)
- `401`: Unauthorized (missing token, invalid scheme, or server not configured)
- `403`: Forbidden (token provided but invalid; some endpoints may also use 403 for policy denial)
- `500`: Internal Server Error (Context ID logged)

## OpenAPI Spec

An OpenAPI 3.0 compatible specification can be generated from the codebase using the `scripts/generate-openapi.ts` utility (if configured). The source of truth for all schemas is `apps/api-worker/src/lib/schemas.ts`.
