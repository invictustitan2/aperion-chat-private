# Cloudflare Deployment Guide

This guide covers deploying the Aperion Chat system to Cloudflare. The architecture consists of a static frontend (Cloudflare Pages) and a serverless backend (Cloudflare Workers).

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

To map `api.aperion.cc` to your worker, add this to `wrangler.toml`:

```toml
[routes]
pattern = "api.aperion.cc/*"
custom_domain = true
```

## 3. Web Deployment (Cloudflare Pages)

The web frontend is a Vite React app.

### Setup via GitHub Actions (Recommended)

This repo deploys the web app from GitHub Actions and uploads the built `apps/web/dist` to Pages.

- `VITE_API_BASE_URL` and `VITE_AUTH_TOKEN` are injected at build time by the workflow.
- If you deploy via GitHub Actions, Pages dashboard environment variables are not used for the build.

### Custom Domain

In the Pages project settings > Custom Domains, add `chat.aperion.cc`.

## 4. Cloudflare Access (Zero Trust)

For a single-user system, **Cloudflare Access is highly recommended** to protect your API and Frontend without implementing complex auth logic in the app itself.

### Strategy

1.  **Protect the Frontend**: Put `chat.aperion.cc` behind Access.
    - Policy: Allow specific email (you).
2.  **Protect the API**: Put `api.aperion.cc` behind Access.
    - **Service Token**: Create a Service Token in Zero Trust.
    - **Policy**: Allow "Service Token" OR "Email" (so you can curl it, and the frontend can call it).
    - **Frontend Integration**: The frontend needs to pass `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers if calling from server-side, or rely on the browser cookie if calling from the browser (same domain/subdomain).
    - _Simpler Alternative_: If Frontend and API are on the same root domain (`aperion.cc`), the Access cookie set on `chat.aperion.cc` can be valid for `api.aperion.cc` if configured correctly (Allow "Same Domain" settings).

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

Configure CORS in `wrangler.toml` or code to ONLY allow your frontend domain (`https://chat.aperion.cc`). Do not use `*`.
