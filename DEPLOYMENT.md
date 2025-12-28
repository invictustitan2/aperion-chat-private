# Deployment Guide

This guide covers deploying the Aperion Chat system to Cloudflare, including GitHub Actions workflows, secrets configuration, and domain setup.

## Architecture Overview

Aperion Chat consists of two main components deployed to Cloudflare:

1. **API Worker** (`apps/api-worker`)
   - Deployed to: Cloudflare Workers
   - Domain: `api.aperion.cc`
   - Route: `api.aperion.cc/*`

2. **Web App** (`apps/web`)
   - Deployed to: Cloudflare Pages
   - Domain: `chat.aperion.cc`

- Project: `aperion-chat-private`

## Prerequisites

- Cloudflare account with Workers and Pages enabled
- Domain (`aperion.cc`) managed by Cloudflare
- GitHub repository access with Actions enabled
- Node.js 20+ and pnpm 9.15.0 installed locally

## Required GitHub Secrets

Navigate to: **Repository → Settings → Secrets and variables → Actions**

### Core Secrets

| Secret Name             | Description                                    | Where to Get It                                                        |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with required permissions | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                     | Cloudflare Dashboard → Workers & Pages → Overview                      |

Optional (only if you want deploy-time smoke tests to call the API through Access without a browser session):

| Secret Name                      | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `CF_ACCESS_SERVICE_TOKEN_ID`     | Cloudflare Access service token client id     |
| `CF_ACCESS_SERVICE_TOKEN_SECRET` | Cloudflare Access service token client secret |

### Cloudflare API Token Permissions

Create a token at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) with:

- **Account** permissions:
  - Workers Scripts: Edit
  - Workers KV Storage: Edit
  - D1: Edit
  - Cloudflare Pages: Edit
  - Account Analytics: Read
- **Zone** permissions (for `aperion.cc`):
  - Workers Routes: Edit
  - DNS: Edit (if using custom domains)

## GitHub Environments

The workflows use GitHub Environments for better organization and protection:

### Production Environment

- **Name:** `production`
- **Protection rules (recommended):**
  - Required reviewers: 1 (yourself)
  - Restrict to `main` branch only

Configure at: **Repository → Settings → Environments → New environment**

## Domain Configuration

### API Worker Domain (api.aperion.cc)

The API Worker uses Cloudflare Worker Custom Domains configured in `wrangler.toml`:

```toml
routes = [
  { pattern = "api.aperion.cc", custom_domain = true, zone_name = "aperion.cc" }
]
```

This automatically creates the necessary DNS records when deployed.

### Web App Domain (chat.aperion.cc)

Configure in Cloudflare Dashboard:

1. Go to **Pages → aperion-chat-private → Custom domains**
2. Click **Set up a custom domain**
3. Enter `chat.aperion.cc`
4. Cloudflare will automatically create a CNAME record

## Cloudflare Worker Secrets

Production auth is Cloudflare Access (JWT/JWKS). The API Worker does **not** require an `API_TOKEN` secret in production.

If you choose to enable optional service-token-based smoke tests, set these Worker secrets:

```bash
cd apps/api-worker
npx wrangler secret put CF_ACCESS_SERVICE_TOKEN_ID
npx wrangler secret put CF_ACCESS_SERVICE_TOKEN_SECRET
```

## Cloudflare Pages Environment Variables

The web app needs environment variables for build-time configuration.

### Set in Cloudflare Dashboard

1. Go to **Pages → aperion-chat-private → Settings → Environment variables**
2. Add the following variables for **Production**:

| Variable Name       | Value                    | Description      |
| ------------------- | ------------------------ | ---------------- |
| `VITE_API_BASE_URL` | `https://api.aperion.cc` | API endpoint URL |

The web UI is **Access-session-only** and must not ship any `VITE_AUTH_TOKEN` references.

## Cloudflare Resources Setup

Before first deployment, ensure these resources exist:

### D1 Database

```bash
# Create database (if not exists)
npx wrangler d1 create aperion-memory

# Update wrangler.toml with the database_id returned
# Then apply migrations
cd apps/api-worker
npx wrangler d1 migrations apply aperion-memory --remote
```

### KV Namespace

```bash
# Create KV namespace
npx wrangler kv:namespace create CACHE_KV

# Update wrangler.toml with the id returned
```

### Vectorize Index

```bash
# Create vectorize index
npx wrangler vectorize create aperion-vectors --dimensions 768 --metric cosine
```

### R2 Bucket

```bash
# Create R2 bucket
npx wrangler r2 bucket create aperion-media
```

### Queue

```bash
# Create queue
npx wrangler queues create aperion-memory-queue
```

## Deployment Workflows

### Automatic Deployments

Deployments are triggered automatically by GitHub Actions **after CI passes**:

#### Production API Worker

- **Trigger:** After CI workflow completes successfully on `main` branch
- **Conditions:**
  - CI must pass
  - Changes detected in:
    - `apps/api-worker/**`
    - `packages/**`
    - `pnpm-lock.yaml`
    - `.github/workflows/deploy-api.yml`
- **Workflow:** `.github/workflows/deploy-api.yml`
- **Environment:** `production`
- **URL:** https://api.aperion.cc

#### Production Web App

- **Trigger:** After CI workflow completes successfully on `main` branch
- **Conditions:**
  - CI must pass
  - Changes detected in:
    - `apps/web/**`
    - `packages/**`
    - `pnpm-lock.yaml`
    - `.github/workflows/deploy-web.yml`
- **Workflow:** `.github/workflows/deploy-web.yml`
- **Environment:** `production`
- **URL:** https://chat.aperion.cc

**Note:** Deployments only run if CI passes. If CI fails, deployments are skipped to prevent deploying broken code.

### Manual Deployments

All production workflows support manual triggering via `workflow_dispatch`.

#### From GitHub UI

1. Go to **Actions** tab
2. Select workflow (Deploy API Worker / Deploy Web App)
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

#### From Local Machine

**API Worker:**

```bash
cd apps/api-worker
npx wrangler deploy
```

**Web App:**

```bash
# Build locally
cd apps/web
pnpm build

# Deploy via wrangler pages
npx wrangler pages deploy dist --project-name aperion-chat-private
```

## Workflow Features

### CI-Gated Deployments

Production deployments only run after CI passes:

- **CI Workflow** runs first on every push to `main`
- **Deploy Workflows** trigger only after CI completes successfully
- If CI fails, deployments are automatically skipped
- Manual deployments via `workflow_dispatch` bypass this check

### Concurrency Control

Workflows include concurrency controls:

- **Production:** Queued (no cancellation of in-progress deployments)
- **CI:** Per-ref (new commits cancel old CI runs)

### Caching Strategy

Workflows cache dependencies and build artifacts:

- **pnpm cache:** Automatic via `setup-node` with `cache: 'pnpm'`
- **Wrangler cache:** Custom cache for Worker builds
- **Playwright browsers:** Cached between CI runs

### Least-Privilege Permissions

Each workflow specifies minimal required permissions:

- `contents: read` - Read repository code
- `deployments: write` - Create deployment records

### Authentication Verification

The API deployment workflow includes optional post-deployment verification.

- If Access service token secrets are configured in GitHub, it performs a service-token-authenticated check.
- Otherwise it skips (production API is still protected by Access).

## Environment Variables Reference

### Local Development (`.env`)

```bash
# Copy template
cp .env.example .env

# Edit with your values:
VITE_API_BASE_URL=http://127.0.0.1:8787
CLOUDFLARE_API_TOKEN=<your-cloudflare-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# Optional: legacy bearer token for local API-only dev (web UI does not use this)
AUTH_TOKEN=<your-token>
```

### GitHub Actions (Secrets)

| Secret                           | Used In               | Description                                  |
| -------------------------------- | --------------------- | -------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`           | All workflows         | Cloudflare API authentication                |
| `CLOUDFLARE_ACCOUNT_ID`          | All workflows         | Cloudflare account identifier                |
| `CF_ACCESS_SERVICE_TOKEN_ID`     | deploy-api (optional) | Access service token id for smoke checks     |
| `CF_ACCESS_SERVICE_TOKEN_SECRET` | deploy-api (optional) | Access service token secret for smoke checks |
| `GITHUB_TOKEN`                   | Automatic             | GitHub Actions automatic token               |

### Cloudflare Worker (Secrets)

| Secret                           | Description                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `CF_ACCESS_SERVICE_TOKEN_ID`     | (Optional) expected `CF-Access-Client-Id` value for service-token auth     |
| `CF_ACCESS_SERVICE_TOKEN_SECRET` | (Optional) expected `CF-Access-Client-Secret` value for service-token auth |

### Cloudflare Pages (Environment Variables)

| Variable            | Value                    | Environment |
| ------------------- | ------------------------ | ----------- |
| `VITE_API_BASE_URL` | `https://api.aperion.cc` | Production  |

## Deployment Commands

### Deploy Everything

```bash
# Build all packages
pnpm -r build

# Deploy API Worker
cd apps/api-worker
npx wrangler deploy

# Deploy Web App
cd ../web
npx wrangler pages deploy dist --project-name aperion-chat-private
```

### Deploy Only API

```bash
cd apps/api-worker
npx wrangler deploy
```

### Deploy Only Web

```bash
cd apps/web
pnpm build
npx wrangler pages deploy dist --project-name aperion-chat-private
```

### Apply Database Migrations

```bash
cd apps/api-worker
npx wrangler d1 migrations apply aperion-memory --remote
```

## Troubleshooting

### Deployment Fails: "Secret not found"

**Problem:** Worker or Pages missing required secrets/env vars.

**Solution:**

1. Set required Worker secrets/vars (see [docs/DEPLOY_PROD.md](docs/DEPLOY_PROD.md))
2. Set Pages env vars in Cloudflare Dashboard (only `VITE_API_BASE_URL`)
3. Set GitHub secrets in repository settings

### Authentication Fails After Deployment

**Problem:** API calls fail with 401/403 or redirects.

**Solution:**

1. Verify Cloudflare Access policies protect both `chat.aperion.cc` and `api.aperion.cc`.
2. If you use service-token smoke tests, ensure `CF_ACCESS_SERVICE_TOKEN_ID` and `CF_ACCESS_SERVICE_TOKEN_SECRET` are set in both GitHub Secrets and Worker secrets.
3. Redeploy API Worker and web.

### Custom Domain Not Working

**Problem:** Domain shows Cloudflare default page or 404.

**Solution for API Worker:**

1. Check `wrangler.toml` has correct route configuration
2. Verify DNS record exists in Cloudflare Dashboard
3. Wait up to 5 minutes for DNS propagation
4. Check Workers route in Dashboard → Workers & Pages → aperion-api-worker → Settings → Triggers

**Solution for Web App:**

1. Add custom domain in Pages settings
2. Wait for DNS propagation
3. Force HTTPS redirection in Pages settings

### Build Fails: Out of Memory

**Problem:** Node runs out of heap space during build.

**Solution:** Workflows already include `NODE_OPTIONS: --max-old-space-size=4096`. If still failing:

1. Check for circular dependencies
2. Reduce parallel builds: `pnpm -r --workspace-concurrency=1 build`
3. Use a larger GitHub Actions runner (if on paid plan)

### CORS Errors in Production

**Problem:** Frontend can't call API due to CORS.

**Solution:**

1. Verify API CORS configuration allows `https://chat.aperion.cc`
2. Check `apps/api-worker/src/middleware/cors.ts`
3. Ensure both domains are using HTTPS
4. Check browser console for specific CORS error

## Monitoring and Logs

### Cloudflare Dashboard

- **Worker Logs:** Workers & Pages → aperion-api-worker → Logs
- **Pages Logs:** Pages → aperion-chat-private → Deployment logs
- **Analytics:** Workers & Pages → aperion-api-worker → Analytics

### GitHub Actions

- **Workflow Runs:** Repository → Actions
- **Deployment History:** Repository → Environments → production

### Verify Deployment

```bash
# Run verification script
./scripts/verify-auth-setup.sh

# Or manually test
curl https://api.aperion.cc/v1/episodic
# Should return 403/302 (Access protected) unless you have an Access session

# Optional: service-token-authenticated request
cat <<EOF | curl -K -
url = "https://api.aperion.cc/v1/episodic"
header = "CF-Access-Client-Id: ${CF_ACCESS_SERVICE_TOKEN_ID}"
header = "CF-Access-Client-Secret: ${CF_ACCESS_SERVICE_TOKEN_SECRET}"
EOF
```

## Security Best Practices

### Access Policy Management

1. Keep Access policies least-privilege (allow only your identity).
2. If you use an Access service token, rotate it periodically and update both GitHub and Worker secrets.

### CORS Configuration

The API restricts CORS to:

- `http://localhost:5173` (local dev)
- `http://127.0.0.1:5173` (local dev)
- `https://chat.aperion.cc` (production)

To add origins, edit `apps/api-worker/src/middleware/cors.ts`.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Authentication Setup Guide](./docs/authentication-setup.md)
- [Cloudflare API Token Permissions](./docs/cloudflare-api-token-permissions.md)

## Support

For issues or questions:

- **Authentication:** See `docs/authentication-setup.md` and `docs/auth-debugging.md`
- **Cloudflare Resources:** See `docs/deploy-cloudflare.md`
- **Verification:** Run `./scripts/verify-auth-setup.sh`
