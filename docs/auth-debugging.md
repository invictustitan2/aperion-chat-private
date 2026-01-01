# Authentication Verification & Debugging

These steps help diagnose Cloudflare Access session issues and CORS failures.

Path B note (same-origin API): CORS troubleshooting applies to the **current** cross-origin setup where the browser calls `https://api.aperion.cc`. The repo supports a same-origin surface at `https://chat.aperion.cc/api/*` (implementation exists), but production should not be assumed to be on that surface until the rollout steps in `docs/path-b/PHASE_3_MIGRATION.md` are executed and verified.

> **📚 For comprehensive setup instructions**, see [Authentication Setup Guide](./authentication-setup.md)

## Quick checklist

1. Ensure you're signed into Cloudflare Access for both `chat.aperion.cc` and `api.aperion.cc`.
2. Ensure `VITE_API_BASE_URL` is set correctly (build-time).

   Notes:
   - Cross-origin mode (current production): `VITE_API_BASE_URL=https://api.aperion.cc`
   - Same-origin mode (after rollout): `VITE_API_BASE_URL=/api` or unset to use the production default `/api`

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

This checks:

- ✓ Local `.env` configuration
- ✓ Worker secrets
- ✓ API connectivity
- ✓ Authentication flow
- ✓ CORS configuration

## Manual Local Verification

```bash
# Confirm env values are visible to the web app build
cat .env | grep VITE_

# Run the existing full verification script (starts the worker, checks auth against /v1/identity)
./scripts/verify-full.sh
```

## UI-level check

The Settings auth debug panel is intentionally hidden in production. Use the browser network tab to confirm requests to the API are receiving Access-protected responses (not CORS failures).

## Common Issues

### 401/403 from API

**Cause:** Missing/invalid Cloudflare Access session (or Access policy misconfiguration).

### CORS Errors

**Cause (current cross-origin mode):** origin not allowed or wrong `VITE_API_BASE_URL`.

If/when Path B is rolled out (same-origin `/api/*`), browser CORS failures should no longer be part of normal operation.

**Fix:** Check that you're accessing from:

- Local: `http://localhost:5173` or `http://127.0.0.1:5173`
- Production: `https://chat.aperion.cc`

## Further Reading

- [Authentication Setup Guide](./authentication-setup.md) - Complete setup instructions
- [Environment Matrix](./environment-matrix.md) - All environment variables
- [Deployment Guide](./deploy-cloudflare.md) - Production deployment
