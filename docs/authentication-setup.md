# Authentication Setup Guide

This guide covers the complete authentication system for Aperion Chat, including token generation, secrets management, and deployment configuration.

## Architecture Overview

Aperion Chat uses a **Bearer token authentication** system:

- **Frontend (Web App)**: Includes the token at build time via `VITE_AUTH_TOKEN`
- **Backend (API Worker)**: Validates the token from the `Authorization` header against `API_TOKEN` secret
- **Token Format**: 256-bit cryptographically secure random token, base64url encoded

### Security Model

- **Single-user system**: One shared token for all requests
- **Token rotation**: Supported by regenerating and updating across all environments
- **CORS protection**: Environment-aware origin restrictions
- **HTTPS only**: Production endpoints enforce TLS

## Token Generation

### Generate a New Token

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

## Where The Token Lives (And Why You Might Not Know It)

In the “Cloudflare-first + GitHub Actions” setup, the production token typically exists only in:

- **GitHub Actions Secret**: `API_TOKEN` (used at deploy time)
- **Cloudflare Worker Secret**: `API_TOKEN` (used at runtime)

Important operational detail:

- **GitHub Actions secrets are not readable after being set** (they can be used by workflows, but not retrieved).
- **Cloudflare Worker secrets are not retrievable** (you can list that a secret exists, but cannot fetch its value).

If you do not have the token value stored anywhere else (password manager, encrypted vault, etc.), the correct remedy is **rotation** (generate a new token and update GitHub + Worker + redeploy the web build).

## Environment Configuration

### 1. Local Development

**File: `.env`** (create from `.env.example`)

```bash
# Copy template
cp .env.example .env

# Edit .env and add your token
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

**Add secret:**

- **Name:** `API_TOKEN`
- **Value:** `<your-generated-token>`

This secret is used by both deployment workflows:

- `deploy-api.yml` - Sets Worker secret and verifies deployment
- `deploy-web.yml` - Injects into build as `VITE_AUTH_TOKEN`

### 3. Cloudflare Worker (Backend)

The Worker needs the token as a **secret** (not a variable) for security.

```bash
cd apps/api-worker

# Set the secret (will prompt for value)
wrangler secret put API_TOKEN

# Or pipe from command
echo "<your-generated-token>" | wrangler secret put API_TOKEN
```

**Verify it's set:**

```bash
wrangler secret list --name aperion-api-worker
```

### 4. Cloudflare Pages (Frontend)

The frontend needs the token baked into the build.

**Recommended:** Deploy the web app via GitHub Actions so the build injects `VITE_AUTH_TOKEN` from the GitHub secret `API_TOKEN`. This avoids having multiple competing sources of truth (GitHub vs Pages dashboard).

**Optional (only for manual dashboard deployments):** Cloudflare Dashboard → Pages → aperion-chat-private → Settings → Environment variables

**Add variable:**

- **Variable name:** `VITE_AUTH_TOKEN`
- **Value:** `<your-generated-token>`
- **Environment:** Production (and Preview if needed)

**Also add:**

- **Variable name:** `VITE_API_BASE_URL`
- **Value:** `https://api.aperion.cc`
- **Environment:** Production

**Redeploy** after adding variables for changes to take effect.

## CORS Configuration

The Worker implements **environment-aware CORS** for security:

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
# Test without auth (should fail)
curl https://api.aperion.cc/v1/identity
# Expected: 401 Unauthorized

# Test with auth (should succeed)
curl -H "Authorization: Bearer <your-token>" https://api.aperion.cc/v1/identity
# Expected: [] or your identity data
```

#### 3. Web App UI

1. Open the web app (local or production)
2. Navigate to **Settings → Authentication Debug**
3. Click **"Run auth self-test"**
4. Verify all checks pass:
   - ✓ Token is configured
   - ✓ API URL is set
   - ✓ Authenticated request succeeds

## Token Rotation

When rotating tokens (recommended every 90 days):

### Step-by-Step Process

1. **Generate new token**

   ```bash
   node scripts/generate-api-token.ts
   ```

2. **Update all environments** (in this order to minimize downtime):

   a. **GitHub Secret** (for future deployments)

   ```
   Repository → Settings → Secrets → Edit API_TOKEN
   ```

   b. **Cloudflare Worker** (backend)

   ```bash
   echo "<new-token>" | wrangler secret put API_TOKEN
   ```

   c. **Redeploy** to rebuild the frontend with the new token

   ```bash
   git commit --allow-empty -m "chore: trigger redeploy for token rotation"
   git push
   ```

   d. **Update local `.env`**

   ```bash
   # Edit .env file
   VITE_AUTH_TOKEN=<new-token>

   # Restart dev servers
   ```

3. **Verify** new token works
   ```bash
   ./scripts/verify-auth-setup.sh
   ```

### Zero-Downtime Rotation (Advanced)

For production systems, implement a grace period:

1. Modify Worker to accept **both** old and new tokens temporarily
2. Update all clients to use new token
3. Remove old token from Worker after verification

## Troubleshooting

### "VITE_AUTH_TOKEN is missing" in browser console

**Cause:** Token not injected at build time

**Solutions:**

- **Local:** Check `.env` file exists and has `VITE_AUTH_TOKEN` set
- **Production:** Ensure your CI deploy injected `VITE_AUTH_TOKEN` during the build, then redeploy
- **After changes:** Restart dev server or redeploy

### 401 Unauthorized errors

**Cause:** Token not sent, token scheme is invalid, or Worker secret not set

**Solutions:**

- Verify Worker secret: `wrangler secret list`
- Check browser Network tab for `Authorization` header
- Verify token matches between frontend and backend

### 403 Forbidden errors

**Cause:** Token sent but doesn't match the Worker secret

**Solutions:**

- Ensure same token in all environments
- Check for extra whitespace or encoding issues
- Regenerate token and update everywhere

### CORS errors in browser

**Cause:** Origin not allowed or CORS misconfigured

**Solutions:**

- Check browser console for specific CORS error
- Verify origin is in allowed list (see CORS Configuration above)
- For local dev, ensure using `http://localhost:5173`
- Check Worker logs for CORS-related errors

### Authentication works locally but not in production

**Possible causes:**

1. **Different tokens** - Verify tokens match
2. **Worker secret not set** - Run `wrangler secret list`
3. **Pages env var not set** - Check Cloudflare Pages settings
4. **Build cache** - Redeploy Pages to rebuild

## Security Considerations

### Current Model

- **Single shared token**: Suitable for single-user system
- **Token in frontend build**: Acceptable for private deployment
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
