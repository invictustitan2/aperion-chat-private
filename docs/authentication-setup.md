# Authentication Setup Guide

This guide covers the authentication model for Aperion Chat.

Path B note (same-origin API): the repo supports mounting the browser API under the same origin as the UI (`https://chat.aperion.cc/api/*`) to eliminate CORS. Implementation exists in the repo, but production should still be treated as cross-origin until the rollout steps in `docs/path-b/PHASE_3_MIGRATION.md` are executed and verified. Until then, production browser builds should keep calling `https://api.aperion.cc` (configured via `VITE_API_BASE_URL`). See `docs/path-b/SAME_ORIGIN_PLAN.md` and `docs/adr/0001-same-origin-api.md`.

## Architecture Overview

Aperion Chat uses **Cloudflare Zero Trust Access** as the production authentication boundary:

- **Frontend (Web App)**: protected by Access; browser carries an Access session.
- **Backend (API Worker)**: verifies Access identity via `CF-Access-Jwt-Assertion` (or `CF_Authorization` cookie) using JWKS.
- **Web UI**: does not bake any bearer token into the client build.

### Security Model

- **Single-user system**: Access policy limits who can reach the app/API
- **Rotation**: Access keys rotate automatically; service tokens can be rotated when needed
- **CORS protection**: Environment-aware origin restrictions (only relevant while browser traffic is cross-origin)
- **HTTPS only**: Production endpoints enforce TLS

## Optional: Legacy Token Auth (API-only)

Legacy bearer-token auth still exists for local API-only development and test scenarios (auth modes `token` / `hybrid`). The web UI does not use this.

### Generate a New Token (Legacy)

```bash
node scripts/generate-api-token.ts
```

This generates a 256-bit secure random token and provides setup instructions.

**Example output:**

```
🔐 Aperion Chat - API Token Generator

✅ Generated new API token (256-bit):

   Xy9kL3mN4pQ5rS6tU7vW8xY9zA0bC1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW1xY2z

📋 Setup Instructions:
...
```

### Token Security Best Practices

1. **Never commit tokens** to version control
2. **Decide whether to share tokens across environments** (optional)
   - This repo’s current GitHub workflows use a single `API_TOKEN` secret for Production and Preview deploys.
   - You can split tokens (e.g., separate `API_TOKEN_PREVIEW`) if you also update workflows + Worker secrets accordingly.
3. **Rotate tokens periodically** (every 90 days recommended)
4. **Store securely** in secret management systems
5. **Limit token exposure** - only set where needed

## Where Auth Lives (And Why You Might Not Know It)

In the “Cloudflare-first + GitHub Actions” setup, production authentication is primarily managed by Cloudflare Access policies.

If you enable optional deploy-time smoke tests through Access, the service token exists only in:

- **GitHub Actions Secrets**: `CF_ACCESS_SERVICE_TOKEN_ID` + `CF_ACCESS_SERVICE_TOKEN_SECRET`
- **Cloudflare Worker Secrets**: `CF_ACCESS_SERVICE_TOKEN_ID` + `CF_ACCESS_SERVICE_TOKEN_SECRET` (for header matching)

Important operational detail:

- **GitHub Actions secrets are not readable after being set** (they can be used by workflows, but not retrieved).
- **Cloudflare Worker secrets are not retrievable** (you can list that a secret exists, but cannot fetch its value).

If you do not have the service token stored anywhere else, the correct remedy is **rotation** (create a new service token and update secrets).

## Environment Configuration

### 1. Local Development

**File: `.env`** (create from `.env.example`)

```bash
# Copy template
cp .env.example .env

# For API-only local dev (legacy token mode)
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_AUTH_TOKEN=<your-generated-token>
```

**Restart dev servers** after changing `.env`:

```bash
# Terminal 1: API Worker
pnpm --filter @aperion/api-worker dev

# Terminal 2: Web App
pnpm --filter @aperion/web dev
```

### 2. GitHub Secrets (CI/CD)

Required for automated deployments.

**Navigate to:** Repository → Settings → Secrets and variables → Actions

Optional: set `CF_ACCESS_SERVICE_TOKEN_ID` and `CF_ACCESS_SERVICE_TOKEN_SECRET` if you want deploy-time smoke tests to call the API through Access.

### 3. Cloudflare Worker (Backend)

In production, the Worker verifies Cloudflare Access identity via JWKS.

Optional: for legacy token mode (API-only dev/test), set `API_TOKEN`.

**Verify it's set:**

```bash
wrangler secret list --name aperion-api-worker
```

### 4. Cloudflare Pages (Frontend)

The web UI is Access-session-only. It must not bake bearer tokens into the build.

Configure only:

- **Variable name:** `VITE_API_BASE_URL`
- **Value (current cross-origin):** `https://api.aperion.cc`
- **Environment:** Production

After Path B rollout (do not apply early):

- Prefer relative base: set `VITE_API_BASE_URL=/api`, or
- Unset `VITE_API_BASE_URL` to use the production default `/api`.

Do not switch production to `/api` (or unset `VITE_API_BASE_URL`) until `chat.aperion.cc/api/*` is actually routed to the Worker and validated.

**Redeploy** after adding variables for changes to take effect.

## CORS Configuration

The Worker implements **environment-aware CORS** for security.

Note: this section is primarily relevant while the browser uses the cross-origin API (`api.aperion.cc`). Path B is intended to remove browser CORS requirements by using same-origin `/api/*`.

### Allowed Origins

| Environment    | Allowed Origins                                  |
| -------------- | ------------------------------------------------ |
| **Local**      | `http://localhost:5173`, `http://127.0.0.1:5173` |
| **Production** | `https://chat.aperion.cc`                        |

Notes:

- The current Worker CORS implementation is a strict allow-list and does **not** automatically allow `*.pages.dev` preview origins.
- Preview deployments can still be useful for build/test verification, but browser-based preview traffic may fail CORS unless you explicitly allow preview origins.

### How It Works

The Worker dynamically checks the `Origin` header and only allows requests from approved domains:

```typescript
function getCorsHeaders(request: IRequest): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://chat.aperion.cc",
  ];

  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[2],
    // ... other headers
  };
}
```

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
pnpm --filter @aperion/api-worker dev

# In another terminal, test without auth (should fail)
curl http://127.0.0.1:8787/v1/identity
# Expected: 401 Unauthorized

# Test with auth (should succeed)
curl -H "Authorization: Bearer <your-token>" http://127.0.0.1:8787/v1/identity
# Expected: [] (empty array of identity records)
```

#### 2. Production

```bash
# Without an Access session, unauthenticated requests typically redirect to Access login.
curl -i https://api.aperion.cc/v1/identity

# With a valid Access session cookie (browser) or a service token (automation), requests should succeed.
# (Bearer Authorization applies only in token/hybrid modes; production is expected to use Access.)
```

#### 3. Web App UI

1. Open the web app (local or production)
2. Navigate to **Settings → Authentication Debug**
3. Click **"Run auth self-test"**
4. Verify all checks pass:
   - ✓ API URL is set
   - ✓ Access session is active
   - ✓ Authenticated request succeeds

## Token Rotation

When rotating tokens (recommended every 90 days):

### Step-by-Step Process

If you use a Cloudflare Access service token (optional, for automation/smoke tests):

1. Create a new service token in Cloudflare Zero Trust.
2. Update GitHub Secrets:
   - `CF_ACCESS_SERVICE_TOKEN_ID`
   - `CF_ACCESS_SERVICE_TOKEN_SECRET`

3. Update Worker secrets:
   - `wrangler secret put CF_ACCESS_SERVICE_TOKEN_ID`
   - `wrangler secret put CF_ACCESS_SERVICE_TOKEN_SECRET`

4. Verify using the repo script:

   ```bash
   ./scripts/verify-auth-setup.sh
   ```

### Zero-Downtime Rotation (Advanced)

For production systems, implement a grace period:

1. Modify Worker to accept **both** old and new tokens temporarily
2. Update all clients to use new token
3. Remove old token from Worker after verification

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
