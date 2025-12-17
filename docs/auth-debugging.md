# Authentication Verification & Debugging

These steps help diagnose the "VITE_AUTH_TOKEN is missing" and CORS failures seen in production logs.

> **📚 For comprehensive setup instructions**, see [Authentication Setup Guide](./authentication-setup.md)

## Quick checklist

1. **Generate a secure token** (if you haven't already):

   ```bash
   node scripts/generate-api-token.ts
   ```

2. Ensure `VITE_AUTH_TOKEN` and `VITE_API_BASE_URL` are set:
   - Local dev: in `.env`
   - Production: injected at build time by your deploy pipeline (recommended: GitHub Actions). If you deploy via GitHub Actions, Pages dashboard env vars are not used for the build.

3. The token must match the API worker configuration. If you rotated the key, redeploy the Pages site so the new token is baked into the client.

4. `VITE_API_BASE_URL` should point to the Worker domain that allows your Page origin; mismatched hosts usually surface as CORS preflight failures.

5. Restart `pnpm dev` after updating env vars so Vite reloads them.

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

# Test API authentication
curl http://127.0.0.1:8787/v1/identity
# Should return 401 Unauthorized

# Test with token
curl -H "Authorization: Bearer <your-token>" http://127.0.0.1:8787/v1/identity
# Should return 200 OK

# Run the existing full verification script (starts the worker, checks auth against /v1/identity)
./scripts/verify-full.sh
```

## UI-level check

Open **Settings → Authentication Debug** in the web app and click **Run auth self-test**. The panel shows:

- Whether your `VITE_AUTH_TOKEN` was injected into the build (token is truncated for safety).
- The API base URL the client will call.
- Success/failure details for an authenticated `/v1/identity` request, which surfaces missing tokens or CORS issues immediately.

Use these results to align the client and Worker configuration before re-running end-to-end flows.

## Common Issues

### "Token is missing" warning

**Cause:** `VITE_AUTH_TOKEN` not set in environment

**Fix:**

- Local: Add to `.env` file
- Production: Ensure your production deploy pipeline injects `VITE_AUTH_TOKEN` at build time (recommended: GitHub Actions)
- Restart dev server or redeploy

### 401 Unauthorized

**Cause:** Worker `API_TOKEN` secret not set

**Fix:**

```bash
cd apps/api-worker
wrangler secret put API_TOKEN
```

### 403 Forbidden

**Cause:** Token mismatch between frontend and backend

**Fix:** Ensure the same token is used in:

- `.env` → `VITE_AUTH_TOKEN`
- Worker secret → `API_TOKEN`

**Fast diagnosis:** The API includes `X-Aperion-Auth-Fingerprint` (a non-secret SHA-256 prefix) and `X-Aperion-Trace-Id` on responses. If the client fingerprint (hash of your `VITE_AUTH_TOKEN`) differs from the server fingerprint, you’ve found the mismatch.

### CORS Errors

**Cause:** Origin not in allowed list

**Fix:** Check that you're accessing from:

- Local: `http://localhost:5173` or `http://127.0.0.1:5173`
- Production: `https://chat.aperion.cc`
- Preview: `*.pages.dev`

## Further Reading

- [Authentication Setup Guide](./authentication-setup.md) - Complete setup instructions
- [Environment Matrix](./environment-matrix.md) - All environment variables
- [Deployment Guide](./deploy-cloudflare.md) - Production deployment
