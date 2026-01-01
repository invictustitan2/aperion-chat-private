# Onboarding & Setup

Path B note (same-origin API): the repo supports a same-origin browser API surface at `https://chat.aperion.cc/api/*` to eliminate CORS. Implementation exists in the repo, but production should be treated as cross-origin until the rollout steps in `docs/path-b/PHASE_3_MIGRATION.md` are executed and verified. Until then, browser builds should keep calling `https://api.aperion.cc` via `VITE_API_BASE_URL`.

## Prerequisites

- Node.js 18+
- pnpm 9+
- Cloudflare Account (for production deployment)
- Python 3+ (for some scripts)

## 1. Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone git@github.com:invictustitan2/aperion-chat-private.git
cd aperion-chat-private

# 2. Install dependencies
pnpm install

# 3. Setup environment variables
cp apps/api-worker/.dev.vars.example apps/api-worker/.dev.vars
# Fill in required keys (or ask a team member for a seed)

# 4. Bootstrap Local Databases & Migrations
pnpm db:migrate:local

# 5. Start Development Servers (Frontend + Worker)
pnpm dev
# Frontend: http://localhost:5173
# API: http://localhost:8787
```

## 2. Environment Configuration

See [Environment Matrix](./environment-matrix.md) for a detailed breakdown of variables across `development`, `preview`, and `production`.

## 3. Deployment

See [Deploy to Cloudflare](./deploy-cloudflare.md) for production deployment instructions.

## 4. Authentication

Production auth is Cloudflare Access (browser carries an Access session; the Worker verifies identity via JWKS).

Legacy bearer-token auth exists for API-only dev/test scenarios (token/hybrid modes), but the shipped web UI is Access-session-only.

See [Authentication Setup](./authentication-setup.md) for the current setup.

## 5. Development Workflow

- **Branching**: Use `feature/` branches.
- **Commits**: Follow Conventional Commits (e.g., `feat(api): ...`).
- **Formatting**: Setup VS Code with Prettier (see [Dev Tools](./dev-tools.md)).
- **Testing**: Run `pnpm test` before pushing.
