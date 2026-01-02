# Authentication Verification & Debugging

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator
> \
> **Canonical for:** Debugging Access session/redirect failures

These steps help diagnose Cloudflare Access session issues, redirect-to-login failures, and WebSocket preflight skips.

Path B note (same-origin API): production browser traffic is same-origin under `https://chat.aperion.cc/api/*` (no CORS). `https://api.aperion.cc` remains supported for tooling/back-compat.

> **📚 For comprehensive setup instructions**, see [Authentication Setup Guide](./authentication-setup.md)

## Quick checklist

1. Ensure you're signed into Cloudflare Access for both `chat.aperion.cc` and `api.aperion.cc`.
2. Ensure `VITE_API_BASE_URL` is set correctly (build-time).

   Notes:
   - Production browser base should be same-origin: `VITE_API_BASE_URL=/api` or unset to use the production default `/api`.
   - `https://api.aperion.cc` is for tooling/back-compat and rollback only.

3. Verify the repo guardrails are green:

   ```bash
   pnpm guard:prod-secrets
   pnpm guard:config-drift
   ```

## Automated Verification

Run the comprehensive verification script:

```bash
./scripts/verify-auth-setup.sh
```

This script is intentionally conservative: it flags client-baked token patterns and performs best-effort checks.

## Manual Local Verification

```bash
# Confirm env values are visible to the web app build
cat .env | grep VITE_

# Run the existing full verification script (starts the worker, checks auth against /v1/identity)
./scripts/verify-full.sh
```

Evidence pointer: `scripts/verify-full.sh` (applies local D1 migrations + starts Worker on `127.0.0.1:8787`).

## UI-level check

In the browser devtools Network tab, check requests to:

- `/api/v1/identity` (production browser contract)

If you see `302` responses to an Access login URL, you do not have a usable Access session for that surface.

## Common Issues

### 401/403 from API

**Cause:** Missing/invalid Cloudflare Access session (or Access policy misconfiguration).

Operator probe (network-gated):

```bash
RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser
```

### CORS Errors

If you are seeing CORS failures in the browser, treat it as a strong signal that the web build is misconfigured (e.g. using a cross-origin base) or that public assets are being redirected by Access.

**Fix:** Check that you're accessing from:

- Local: `http://localhost:5173` or `http://127.0.0.1:5173`
- Production: `https://chat.aperion.cc`

Operator probe (network-gated):

```bash
RUN_NETWORK_TESTS=1 ./dev pwa:probe
```

Evidence pointer: `devshell/commands/pwa_probe.sh`.

### WebSocket closes / skips

The web client performs an identity preflight before attempting WebSocket connect. If `/v1/identity` is redirected (Access login) or returns `401/403`, it will skip the WS connection and emit a single diagnostic line.

Evidence pointer: `apps/web/src/hooks/useWebSocket.ts`.

## Further Reading

- [Authentication Setup Guide](./authentication-setup.md) - Complete setup instructions
- [Environment Matrix](./environment-matrix.md) - All environment variables
- [Deployment Guide](./deploy-cloudflare.md) - Production deployment
