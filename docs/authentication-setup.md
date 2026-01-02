# Authentication Setup Guide

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** Auth model overview and local setup notes

This guide covers the authentication model for Aperion Chat.

Path B note (same-origin API): production browser traffic is same-origin under `https://chat.aperion.cc/api/*` (no CORS). `https://api.aperion.cc` remains supported for tooling/back-compat.

## Architecture Overview (implemented)

Production authentication is Cloudflare Access.

- The browser client always sends requests with `credentials: "include"` (cookies), and does not attach bearer tokens by default.
  - Evidence: `apps/web/src/lib/api.ts`.
- The API Worker authenticates requests using a strict, ordered set of mechanisms:
  1.  **Service token headers**: `CF-Access-Client-Id` + `CF-Access-Client-Secret` (if configured in Worker env).
  2.  **Access JWT assertion**: `CF-Access-Jwt-Assertion` (or `X-CF-Access-Jwt-Assertion`), or `CF_Authorization` cookie.
  3.  **Legacy bearer token** (dev/test only): `Authorization: Bearer <token>`. For WebSocket-only callers, a `?token=` query parameter is also supported.
  - Evidence: `apps/api-worker/src/lib/authContext.ts`.

## Legacy token auth (API-only dev/test)

Legacy bearer-token auth exists for API-only development and tests when the Worker is in `token` or `hybrid` mode.

Important: the web UI does not rely on a client-baked token. The repo’s verification scripts explicitly treat `VITE_AUTH_TOKEN` as a configuration error.

Evidence pointers:

- `apps/api-worker/src/lib/authContext.ts` (legacy bearer token and WS query token)
- `scripts/verify-auth-setup.sh` (fails if `VITE_AUTH_TOKEN` is present)

### Generate a New Token (Legacy)

```bash
npx tsx scripts/generate-api-token.ts
```

This generates a 256-bit secure random token and prints setup instructions.

Evidence pointer: `scripts/generate-api-token.ts`.

## Environment Configuration

### 1. Local Development

There are two supported local auth shapes, depending on what you are trying to test.

**A) Default local dev (token mode):**

- If Access env vars are not set, the Worker defaults to `token` mode.
- In token mode, the Worker requires `API_TOKEN` (Worker env) and expects the client to send `Authorization: Bearer <token>`.

Evidence pointer: `apps/api-worker/src/lib/authContext.ts`.

**B) Access-mode local dev (optional):**

- If `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` are set (and/or `APERION_AUTH_MODE=access`), the Worker will authenticate via Access JWT assertions.
- In Access mode, missing Access assertions fail closed.

Evidence pointers:

- `apps/api-worker/src/lib/authContext.ts` (mode selection and failure behavior)
- `apps/api-worker/wrangler.toml` (required vars comment list)

The repo’s `.env` is used by some scripts (not by Wrangler) and can be created from `.env.example`.

```bash
cp .env.example .env
```

For running servers manually:

```bash
# Terminal 1: Worker
pnpm -C apps/api-worker dev:api

# Terminal 2: Web
pnpm -C apps/web dev
```

### 2. GitHub Secrets (CI/CD)

Required for automated deployments.

**Navigate to:** Repository → Settings → Secrets and variables → Actions

Optional: set `CF_ACCESS_SERVICE_TOKEN_ID` and `CF_ACCESS_SERVICE_TOKEN_SECRET` if you want deploy-time smoke tests to call the API through Access.

### 3. Cloudflare Worker (Backend)

In production, the Worker verifies Cloudflare Access identity via JWKS (`/cdn-cgi/access/certs`).

Evidence pointer: `apps/api-worker/src/lib/authContext.ts` (JWKS fetch + verification).

Optional: for legacy token mode (API-only dev/test), set `API_TOKEN`.

**Verify it's set:**

```bash
wrangler secret list --name aperion-api-worker
```

### 4. Cloudflare Pages (Frontend)

The web UI is Access-session-only. It must not bake bearer tokens into the build.

Production browser builds should use the same-origin base:

- Prefer: set `VITE_API_BASE_URL=/api`, or
- Omit/unset `VITE_API_BASE_URL` to use the production default `/api`.

Evidence pointer: `apps/web/src/lib/apiBaseUrl.ts`.

**Redeploy** after adding variables for changes to take effect.

## CORS Configuration

The Worker implements a strict CORS allow-list.

Note: in the current production contract (Path B), browser traffic is same-origin and CORS should not normally be part of the failure mode.

### Allowed Origins

Allowed origins are currently hard-coded to:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://chat.aperion.cc`

Evidence pointer: `apps/api-worker/src/middleware/cors.ts`.

## Verification

### Automated Verification

Run the comprehensive verification script:

```bash
./scripts/verify-auth-setup.sh
```

This checks:

- ✓ Local `.env` configuration
- ✓ Worker `wrangler.toml` setup
- ✓ Worker secrets (if authenticated)
- ✓ Local API connectivity and authentication
- ✓ Production API accessibility (optional)
- ✓ CORS configuration

### Manual Verification

#### 1. Local Development

```bash
# Start the Worker
pnpm -C apps/api-worker dev:api

# In another terminal, test without auth (should fail)
curl http://127.0.0.1:8787/v1/identity
# Expected: 401 Unauthorized

# Test with auth (should succeed)
curl -H "Authorization: Bearer <your-token>" http://127.0.0.1:8787/v1/identity
# Expected: 200 OK
```

## Troubleshooting

### Access login redirects / 403s

**Cause:** Missing/invalid Cloudflare Access session or Access policy misconfiguration.

### 401 Unauthorized errors

**Cause:** Request reached the Worker but did not include a valid Access assertion.

### 403 Forbidden errors

**Cause:** Cloudflare Access blocked the request at the edge, or legacy bearer token auth rejected credentials.

### CORS errors in browser

**Cause:** Origin not allowed or CORS misconfigured

**Solutions:**

- Check browser console for specific CORS error
- Verify origin is in allowed list (see CORS Configuration above)
- For local dev, ensure using `http://localhost:5173`
- Check Worker logs for CORS-related errors

### Authentication works locally but not in production

**Possible causes:**

1. Access app/policy misconfigured for production domains
2. Missing/incorrect Worker vars: `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`

   Note: `CF_ACCESS_AUD` can be a comma-separated allowlist (e.g. `aud-api,aud-chat`). This is useful when multiple Cloudflare Access applications protect different hostnames (for example `api.aperion.cc` vs `chat.aperion.cc/api/*`).

3. Service token mismatch (if you use service tokens)

## Security Considerations

### Current Model

- **Cloudflare Access boundary**: Suitable for single-user system
- **No token in frontend build**: web is Access-session-only
- **HTTPS enforcement**: Required for production

### Future Enhancements

For multi-user or public deployments, consider:

1. **User-specific tokens**: Generate per-user tokens
2. **Token expiration**: Implement JWT with expiry
3. **OAuth/OIDC**: Integrate with identity providers
4. **Rate limiting**: Prevent brute force attacks
5. **Audit logging**: Track authentication attempts

## Related Documentation

- [Environment Matrix](./environment-matrix.md) - All environment variables
- [Auth Debugging](./auth-debugging.md) - Quick debugging steps
- [Deployment Guide](./deploy-cloudflare.md) - Full deployment instructions
