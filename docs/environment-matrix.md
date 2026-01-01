# Environment Matrix

This document outlines the configuration required for each environment in the Aperion Chat lifecycle.

## Environments

| Feature      | Local (Development)                             | Staging (Preview)               | Production                           |
| :----------- | :---------------------------------------------- | :------------------------------ | :----------------------------------- |
| **Host**     | `localhost` / `127.0.0.1`                       | `*.pages.dev` / `*.workers.dev` | `chat.aperion.cc` / `api.aperion.cc` |
| **Runtime**  | `wrangler dev` / `vite`                         | Cloudflare Workers / Pages      | Cloudflare Workers / Pages           |
| **Database** | Local SQLite (`.wrangler/`)                     | D1 (Preview Database)           | D1 (Production Database)             |
| **Auth**     | Legacy token (API-only) or Access (recommended) | Cloudflare Access               | Cloudflare Access                    |
| **Logs**     | Terminal / `worker.log`                         | `wrangler tail`                 | Cloudflare Observability / Tail      |

Notes:

- Production auth is Cloudflare Access (JWT/JWKS). The web UI is Access-session-only.
- Preview browser traffic may fail CORS if preview origins are not included in the Worker allow-list.

Path B note (same-origin API):

- The repo supports a migration to mount the API under the same origin as the UI (`https://chat.aperion.cc/api/*`) to eliminate CORS.
- Implementation exists in the repo; production should still be treated as cross-origin until the rollout steps in `docs/path-b/PHASE_3_MIGRATION.md` have been executed and verified.
- Until then, production browser builds should keep using `VITE_API_BASE_URL=https://api.aperion.cc`.

## Secrets & Variables

| Variable Name           | Description                     | Local Source                        | Production Source                                                                                        |
| :---------------------- | :------------------------------ | :---------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `API_TOKEN`             | Worker-side bearer token secret | `wrangler dev`/env (Worker runtime) | `wrangler secret` (Worker)                                                                               |
| `CLOUDFLARE_API_TOKEN`  | CI/CD deployment token          | `.env`                              | GitHub Secrets / CI                                                                                      |
| `VITE_API_BASE_URL`     | API base (absolute or relative) | `.env` (`http://127.0.0.1:8787`)    | Build Env (current: `https://api.aperion.cc`; after Path B rollout: relative `/api` or unset to default) |
| `CF_ACCESS_TEAM_DOMAIN` | Access team domain / slug       | n/a                                 | Worker vars                                                                                              |
| `CF_ACCESS_AUD`         | Access app audience             | n/a                                 | Worker vars                                                                                              |
| `AWS_ACCESS_KEY_ID`     | AWS Identity                    | `~/.aws/credentials`                | `wrangler secret`                                                                                        |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret                      | `~/.aws/credentials`                | `wrangler secret`                                                                                        |
| `AWS_REGION`            | AWS Region (e.g., us-east-1)    | `~/.aws/config`                     | `wrangler.toml` / Env Var                                                                                |

## Bindings (wrangler.toml)

| Binding Name    | Type         | Description                                                 |
| :-------------- | :----------- | :---------------------------------------------------------- |
| `MEMORY_DB`     | D1 Database  | Stores episodic memory and entity data.                     |
| `APERION_CACHE` | KV Namespace | Caches frequent policy lookups or session data.             |
| `AI`            | Workers AI   | Access to Cloudflare AI models (Embeddings, Chat, Whisper). |
| `VECTORIZE`     | Vectorize    | Vector database for semantic search and long-term memory.   |

## Deployment Checklist

- [ ] **Secrets Set**: Ensure all secrets in the matrix are set via `wrangler secret put`.
- [ ] **Migrations Applied**: Run `wrangler d1 migrations apply aperion-memory --remote`.
- [ ] **Domain Verified**: DNS records for custom domains are active.
- [ ] **Access Policy**: Cloudflare Access policies are enforcing authentication.
- [ ] **CORS**: API allows requests from the Frontend domain (only relevant while the browser uses `api.aperion.cc`).
