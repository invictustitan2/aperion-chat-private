# Aperion Chat Private

## Overview

- **Single-user, private, memory-backed** chat system.
- **Cloudflare-first stack**: Workers + D1 + KV + Durable Objects.
- **Optional AWS sidecar** for additional capabilities.
- **Provenance-first memory engine**.

## Philosophy

- **Always progressive**: Never remove features; only improve.
- **Tests required**: Every new module/function must have tests; no placeholders; all tests must pass.

## Setup

See `./scripts/bootstrap.sh` to get started.

## Voice (Speech-to-Text / Text-to-Speech)

The API worker includes a `/v1/voice-chat` endpoint that accepts `multipart/form-data` with an `audio` file (16kHz LINEAR16) and returns a JSON payload containing the transcription and an MP3 (base64).

The endpoint generates `assistantText` using Google AI Studio (Gemini). Configure it with:

- `GEMINI_API_KEY` (store as a Cloudflare Worker secret)
- `GEMINI_MODEL` (optional; defaults to `gemini-1.5-flash`)

Environment variables:

- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (local Node usage)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (recommended for Cloudflare Workers: store as a secret JSON string)
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Implementation note: the Worker uses Google REST APIs + WebCrypto (Workers-compatible). It does not require Node client libraries like `@google-cloud/speech`.
