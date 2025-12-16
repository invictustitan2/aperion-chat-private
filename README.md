# Aperion Chat Private

## Overview

- **Single-user, private, memory-backed** chat system.
- **Cloudflare-first stack**: Workers + D1 + KV + Durable Objects + Workers AI + Vectorize.
- **Optional AWS sidecar** for additional capabilities.
- **Provenance-first memory engine**.

## Philosophy

- **Always progressive**: Never remove features; only improve.
- **Tests required**: Every new module/function must have tests; no placeholders; all tests must pass.
- **Reliability First**: See [Reliability Plan](./docs/RELIABILITY_PLAN.md) and [Dev Tools](./docs/dev-tools.md).

## Setup

See `./scripts/bootstrap.sh` to get started.

## Voice (Speech-to-Text / Text-to-Speech)

The API worker includes a `/v1/voice-chat` endpoint that accepts `multipart/form-data` with an `audio` file (16kHz LINEAR16 or WebM) and returns a JSON payload containing the transcription and an MP3 (base64) or triggers client-side TTS.

- **Speech-to-Text**: Uses Cloudflare Workers AI (`@cf/openai/whisper`) by default for privacy and speed. Falls back to Google Cloud STT if configured.
- **Text-to-Speech**: Uses Google Cloud TTS if credentials provided, otherwise falls back to browser `speechSynthesis`.
- **Response Generation**: Uses Workers AI (Llama 3) or Google Gemini.

Environment variables:

- `GOOGLE_CLOUD_PROJECT_ID` (Optional: for Google TTS/STT fallback)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Optional: for Google TTS/STT fallback)
- `GEMINI_API_KEY` (Optional: for Gemini models)
- `GEMINI_MODEL` (Optional)
