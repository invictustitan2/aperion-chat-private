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
