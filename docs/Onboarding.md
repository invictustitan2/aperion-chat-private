# Onboarding & Setup

> **Status:** Full
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev

Path B note (production browser contract): the web app defaults to same-origin `/api` in production builds, and the Worker is routed at `chat.aperion.cc/api/*`. The `api.aperion.cc` custom domain remains for tooling/back-compat.

Evidence pointers:

- `apps/web/src/lib/apiBaseUrl.ts` (prod default `/api`, dev default local worker)
- `apps/api-worker/wrangler.toml` (routes include `chat.aperion.cc/api/*` and `api.aperion.cc`)

## Prerequisites

- Node.js >= 20 (repo root `package.json` engines)
- pnpm 9.x (repo root `package.json`)
- For devshell + repo checks on Linux: run `./scripts/bootstrap-dev.sh` (installs `curl`, `jq`, `rg`, `shellcheck`, `shfmt`, `bats`)

## Local development (recommended)

Run the repo’s “full verification” cycle. This applies local D1 migrations, starts the Worker on `127.0.0.1:8787`, then runs `pnpm verify`.

```bash
pnpm install
./scripts/verify-full.sh
```

Evidence pointer: `scripts/verify-full.sh`.

## Local development (manual: run web + worker)

Terminal 1 (API Worker):

```bash
pnpm -C apps/api-worker dev:api
```

Terminal 2 (Web app):

```bash
pnpm -C apps/web dev
```

Notes:

- If `VITE_API_BASE_URL` is unset in dev, the web client defaults to `http://127.0.0.1:8787`.
- If you need local DB migrations explicitly: `pnpm -C apps/api-worker db:migrate:local` (or see `scripts/verify-full.sh`).

## Devshell (operator workflows)

The canonical entrypoint is `./dev`.

```bash
./dev help
./dev verify:ci
```

Evidence pointer: `devshell/entry.sh`.

## Next reading

- Auth: [docs/authentication-setup.md](./authentication-setup.md)
- Auth debugging: [docs/auth-debugging.md](./auth-debugging.md)
- Deploy/runbooks: [docs/DEPLOY_PROD_RUN.md](./DEPLOY_PROD_RUN.md) and [docs/Runbooks.md](./Runbooks.md)
