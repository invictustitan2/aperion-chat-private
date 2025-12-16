# Onboarding & Setup

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

The system uses a shared secret Bearer Token for API access.
See [Authentication Setup](./authentication-setup.md) for configuring tokens in local and production environments.

## 5. Development Workflow

- **Branching**: Use `feature/` branches.
- **Commits**: Follow Conventional Commits (e.g., `feat(api): ...`).
- **Formatting**: Setup VS Code with Prettier (see [Dev Tools](./dev-tools.md)).
- **Testing**: Run `pnpm test` before pushing.
