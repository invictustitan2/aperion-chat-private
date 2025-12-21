# Authentication Verification & Debugging

These steps help diagnose Cloudflare Access session issues and CORS failures.

> **📚 For comprehensive setup instructions**, see [Authentication Setup Guide](./authentication-setup.md)

## Quick checklist

1. Ensure you're signed into Cloudflare Access for both `chat.aperion.cc` and `api.aperion.cc`.
2. Ensure `VITE_API_BASE_URL` is set correctly (build-time).
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

**Cause:** origin not allowed or wrong `VITE_API_BASE_URL`.

**Fix:** Check that you're accessing from:

- Local: `http://localhost:5173` or `http://127.0.0.1:5173`
- Production: `https://chat.aperion.cc`

## Further Reading

- [Authentication Setup Guide](./authentication-setup.md) - Complete setup instructions
- [Environment Matrix](./environment-matrix.md) - All environment variables
- [Deployment Guide](./deploy-cloudflare.md) - Production deployment
