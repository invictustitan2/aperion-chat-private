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
   - Project: `aperion-chat-web`

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
| `API_TOKEN`             | Shared authentication token for API requests   | Generate with `npx tsx scripts/generate-api-token.ts`                  |

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

### Preview Environment

- **Name:** `preview`
- **Used for:** Pull request preview deployments
- **No protection rules needed** (deploys automatically on PR)

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

1. Go to **Pages → aperion-chat-web → Custom domains**
2. Click **Set up a custom domain**
3. Enter `chat.aperion.cc`
4. Cloudflare will automatically create a CNAME record

## Cloudflare Worker Secrets

The API Worker requires the `API_TOKEN` secret to be set in Cloudflare.

### Set Worker Secret

```bash
cd apps/api-worker
npx wrangler secret put API_TOKEN
# Enter the same token value used in GitHub secrets
```

### Verify Secrets

```bash
npx wrangler secret list
```

## Cloudflare Pages Environment Variables

The web app needs environment variables for build-time configuration.

### Set in Cloudflare Dashboard

1. Go to **Pages → aperion-chat-web → Settings → Environment variables**
2. Add the following variables for **Production**:

| Variable Name       | Value                    | Description                             |
| ------------------- | ------------------------ | --------------------------------------- |
| `VITE_API_BASE_URL` | `https://api.aperion.cc` | API endpoint URL                        |
| `VITE_AUTH_TOKEN`   | `<same-as-API_TOKEN>`    | Authentication token (baked into build) |

**Note:** The Pages deployment workflow also injects these at build time, but setting them in the dashboard ensures they're used for manual deployments.

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

Deployments are triggered automatically by GitHub Actions:

#### Production API Worker

- **Trigger:** Push to `main` with changes in:
  - `apps/api-worker/**`
  - `packages/**`
  - `pnpm-lock.yaml`
  - `.github/workflows/deploy-api.yml`
- **Workflow:** `.github/workflows/deploy-api.yml`
- **Environment:** `production`
- **URL:** https://api.aperion.cc

#### Production Web App

- **Trigger:** Push to `main` with changes in:
  - `apps/web/**`
  - `packages/**`
  - `pnpm-lock.yaml`
  - `.github/workflows/deploy-web.yml`
- **Workflow:** `.github/workflows/deploy-web.yml`
- **Environment:** `production`
- **URL:** https://chat.aperion.cc

#### Preview Deployments (PR)

- **Trigger:** Pull request opened/updated
- **Workflow:** `.github/workflows/preview.yml`
- **Environment:** `preview`
- **URLs:** Posted as PR comment
  - Web: `*.pages.dev` subdomain
  - API: Uses production API (dry-run deployment)

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
npx wrangler pages deploy dist --project-name aperion-chat-web
```

## Workflow Features

### Concurrency Control

All workflows include concurrency controls:

- **Production:** Queued (no cancellation of in-progress deployments)
- **Preview:** Per-PR (new commits cancel old preview deployments)
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
- `pull-requests: write` - Comment on PRs (preview workflow)

### Authentication Verification

The API deployment workflow includes post-deployment verification:

1. Test without auth (expects 401)
2. Test with auth (expects 200)
3. Fails deployment if authentication is broken

## Environment Variables Reference

### Local Development (`.env`)

```bash
# Copy template
cp .env.example .env

# Edit with your values:
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_AUTH_TOKEN=<your-token>
CLOUDFLARE_API_TOKEN=<your-cloudflare-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

### GitHub Actions (Secrets)

| Secret                  | Used In             | Description                     |
| ----------------------- | ------------------- | ------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | All workflows       | Cloudflare API authentication   |
| `CLOUDFLARE_ACCOUNT_ID` | All workflows       | Cloudflare account identifier   |
| `API_TOKEN`             | deploy-web, preview | Shared API authentication token |
| `GITHUB_TOKEN`          | preview             | Automatic (for PR comments)     |

### Cloudflare Worker (Secrets)

| Secret      | Description                                     |
| ----------- | ----------------------------------------------- |
| `API_TOKEN` | Validates Bearer tokens in Authorization header |

### Cloudflare Pages (Environment Variables)

| Variable            | Value                    | Environment |
| ------------------- | ------------------------ | ----------- |
| `VITE_API_BASE_URL` | `https://api.aperion.cc` | Production  |
| `VITE_AUTH_TOKEN`   | `<token>`                | Production  |

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
npx wrangler pages deploy dist --project-name aperion-chat-web
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
npx wrangler pages deploy dist --project-name aperion-chat-web
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

1. Set Worker secret: `npx wrangler secret put API_TOKEN`
2. Set Pages env vars in Cloudflare Dashboard
3. Set GitHub secrets in repository settings

### Authentication Fails After Deployment

**Problem:** Token mismatch between frontend and backend.

**Solution:**

1. Verify tokens match:
   - GitHub secret `API_TOKEN`
   - Worker secret `API_TOKEN` (via `wrangler secret list`)
   - Pages env var `VITE_AUTH_TOKEN`
2. Regenerate token: `npx tsx scripts/generate-api-token.ts`
3. Update all three locations
4. Redeploy

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
- **Pages Logs:** Pages → aperion-chat-web → Deployment logs
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
# Should return 401 (requires auth)

curl -H "Authorization: Bearer $API_TOKEN" https://api.aperion.cc/v1/episodic
# Should return 200 with data
```

## Security Best Practices

### Token Management

1. **Never commit tokens** to version control
2. **Rotate tokens every 90 days** (recommended)
3. **Use different tokens** for dev/prod (optional but recommended)
4. **Audit token access** regularly

### Secrets Rotation

When rotating the API token:

1. Generate new token: `npx tsx scripts/generate-api-token.ts`
2. Update GitHub secret `API_TOKEN`
3. Update Worker secret: `npx wrangler secret put API_TOKEN`
4. Update Pages env var `VITE_AUTH_TOKEN`
5. Trigger new deployments for both API and Web
6. Verify with test requests

### CORS Configuration

The API restricts CORS to:

- `http://localhost:5173` (local dev)
- `http://127.0.0.1:5173` (local dev)
- `https://chat.aperion.cc` (production)
- `*.pages.dev` (preview deployments)

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
