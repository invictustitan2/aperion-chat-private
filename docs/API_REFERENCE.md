# API Reference

The Aperion Chat API is a RESTful interface running on Cloudflare Workers. It uses Bearer Token authentication and JSON payloads.

**Base URL**: `https://api.aperion.cc` (Production) / `http://localhost:8787` (Local)

## Authentication

All requests must include the `Authorization` header:

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
- `401`: Unauthorized (Missing/Invalid Token)
- `403`: Forbidden (Policy denied)
- `500`: Internal Server Error (Context ID logged)

## OpenAPI Spec

An OpenAPI 3.0 compatible specification can be generated from the codebase using the `scripts/generate-openapi.ts` utility (if configured). The source of truth for all schemas is `apps/api-worker/src/lib/schemas.ts`.
