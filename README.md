# Aperion Chat Private

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** Repo entrypoint and “start here” links

Single-user, private chat system deployed via Cloudflare Pages + Workers.

Path B note (browser contract): production browser traffic is same-origin under `https://chat.aperion.cc/api/*` (the web app defaults to `/api` in production builds). `https://api.aperion.cc/v1/*` remains supported for tooling/back-compat.

## Start here (canonical)

- Docs index: [docs/INDEX.md](./docs/INDEX.md)
- Project truth / current reality: [docs/PROJECT_STATE.md](./docs/PROJECT_STATE.md)
- Production deploy + validation (receipts-first): [docs/DEPLOY_PROD_RUN.md](./docs/DEPLOY_PROD_RUN.md)
- API surface: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

## Local dev (quick)

Prereqs (repo-enforced): Node.js >= 20 and pnpm 9.x.

- Install dev tooling (Linux): `./scripts/bootstrap-dev.sh`
- Full local verification cycle (starts local Worker on `127.0.0.1:8787` and runs `pnpm verify`): `./scripts/verify-full.sh`

## Devshell (operator workflows)

- Entry point: `./dev help`
- Secrets file default: `~/.config/aperion/cf_access.env` (override via `APERION_SECRETS_FILE=...`)

Docs: [docs/devshell.md](./docs/devshell.md)

## Deploy

- Canonical runbook: [docs/DEPLOY_PROD_RUN.md](./docs/DEPLOY_PROD_RUN.md)
- Cloudflare surface map (names only): [docs/CLOUDFLARE_SURFACE.md](./docs/CLOUDFLARE_SURFACE.md)
