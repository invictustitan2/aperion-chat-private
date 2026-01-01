# Cloudflare Deployment Guide

This guide covers deploying the Aperion Chat system to Cloudflare. The architecture consists of a static frontend (Cloudflare Pages) and a serverless backend (Cloudflare Workers).

Path B note (same-origin API): the repo supports a migration to mount the API under the same origin as the UI (`https://chat.aperion.cc/api/*`) to eliminate CORS. Implementation exists in the repo, but production should still be treated as cross-origin until the Worker route + deploy steps in `docs/path-b/PHASE_3_MIGRATION.md` are executed and verified.

## 1. Prerequisites

- Cloudflare Account
- `npm` or `pnpm` installed
- `wrangler` CLI authenticated (`npx wrangler login`)
- A domain name (e.g., `aperion.cc`) managed by Cloudflare (recommended)

## 2. API Worker Deployment

The API Worker handles memory, policy, and orchestration.

### Configuration

Ensure `apps/api-worker/wrangler.toml` is configured. Avoid hardcoding IDs; use environment variables or separate toml files for environments if needed.

### Bindings Setup

You need to create the D1 database and KV namespace on Cloudflare before deploying.

```bash
# Create D1 Database
npx wrangler d1 create aperion-memory

# Create KV Namespace
npx wrangler kv:namespace create APERION_CACHE
```

Update your `wrangler.toml` with the IDs returned by these commands.

### Secrets

Set the required secrets in Cloudflare.

```bash
cd apps/api-worker

# The shared authentication token
npx wrangler secret put API_TOKEN

# AWS Credentials (if using S3/Bedrock)
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
```

### Deploy

```bash
cd apps/api-worker
pnpm run deploy
# or
npx wrangler deploy
```

### Custom Domain

To map `api.aperion.cc` to your worker, configure a Worker custom domain route in `apps/api-worker/wrangler.toml`.

This repo uses the `routes = [...]` style:

```toml
routes = [
    { pattern = "api.aperion.cc", custom_domain = true, zone_name = "aperion.cc" }
]
```

## 3. Web Deployment (Cloudflare Pages)

The web frontend is a Vite React app.

### Setup via GitHub Actions (Recommended)

This repo deploys the web app from GitHub Actions and uploads the built `apps/web/dist` to Pages.

- `VITE_API_BASE_URL` is injected at build time by the workflow.
- The web UI is Access-session-only and must not inject or reference `VITE_AUTH_TOKEN`.

Note: the web app supports both:

- Absolute base (current production): `VITE_API_BASE_URL=https://api.aperion.cc`
- Relative base (Path B target): `VITE_API_BASE_URL=/api` (or unset in production builds to default to `/api`)

Do not switch production to `/api` (or unset `VITE_API_BASE_URL`) until `chat.aperion.cc/api/*` is actually routed to the Worker and verified.

Operational note: GitHub Actions secrets and Cloudflare Worker secrets are effectively write-only. You can use them in workflows/runtime, but you generally cannot retrieve the plaintext value later. Keep the token in a secure vault/password manager, or rotate it if it’s lost.

### Custom Domain

In the Pages project settings > Custom Domains, add `chat.aperion.cc`.

## 4. Cloudflare Access (Zero Trust)

For a single-user system, **Cloudflare Access is required** in production to protect your API and Frontend.

### Strategy

1.  **Protect the Frontend**: Put `chat.aperion.cc` behind Access.
    - Policy: Allow specific email (you).
2.  **Protect the API**: Put `api.aperion.cc` behind Access.
    - **Policy**: Allow your identity (email) for interactive access.
    - **Optional Service Token**: Create a service token for automation/smoke tests.
    - **Worker auth**: The Worker validates Access identity via `CF-Access-Jwt-Assertion` / `CF_Authorization` cookie using JWKS.

## 5. No Footguns (Security Best Practices)

### 🚫 Never Expose Admin Endpoints

If you add endpoints like `/admin/wipe-memory` or `/debug/dump`, ensure they are strictly protected.

- **Best Practice**: Wrap them in a check for a specific high-privilege secret or Cloudflare Access Group.

### 🔄 Token Rotation

If your API bearer token is compromised:

1.  Generate a new token: `openssl rand -hex 32`
2.  Update Worker secret: `npx wrangler secret put API_TOKEN`
3.  Update Client (Frontend env var or local storage).
4.  Redeploy API Worker (secrets update usually triggers reload, but safe to redeploy).

### 🪵 Log Hygiene

- **NEVER** `console.log(env)`.
- **NEVER** log raw request headers (Authorization).
- **NEVER** log the full body of requests containing sensitive PII or keys.
- Use `console.log` for structured events: `console.log(JSON.stringify({ event: "memory_stored", id: ... }))`.

### 🔒 CORS

Configure CORS in code to ONLY allow your frontend domain (`https://chat.aperion.cc`). Do not use `*`.

Note: this section is only relevant while the browser uses the cross-origin API (`api.aperion.cc`). Path B is intended to remove browser CORS requirements by using same-origin `/api/*`.
