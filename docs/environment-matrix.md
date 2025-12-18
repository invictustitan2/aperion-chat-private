# Environment Matrix

This document outlines the configuration required for each environment in the Aperion Chat lifecycle.

## Environments

| Feature      | Local (Development)              | Staging (Preview)                                       | Production                                              |
| :----------- | :------------------------------- | :------------------------------------------------------ | :------------------------------------------------------ |
| **Host**     | `localhost` / `127.0.0.1`        | `*.pages.dev` / `*.workers.dev`                         | `chat.aperion.cc` / `api.aperion.cc`                    |
| **Runtime**  | `wrangler dev` / `vite`          | Cloudflare Workers / Pages                              | Cloudflare Workers / Pages                              |
| **Database** | Local SQLite (`.wrangler/`)      | D1 (Preview Database)                                   | D1 (Production Database)                                |
| **Auth**     | Bearer token (`VITE_AUTH_TOKEN`) | Bearer token (GitHub Actions injects `VITE_AUTH_TOKEN`) | Bearer token (GitHub Actions injects `VITE_AUTH_TOKEN`) |
| **Logs**     | Terminal / `worker.log`          | `wrangler tail`                                         | Cloudflare Observability / Tail                         |

Notes:

- Cloudflare Access is optional and recommended for additional protection, but the app’s primary auth mechanism is the shared bearer token.
- Preview browser traffic may fail CORS if preview origins are not included in the Worker allow-list.

## Secrets & Variables

| Variable Name           | Description                     | Local Source                        | Production Source                      |
| :---------------------- | :------------------------------ | :---------------------------------- | :------------------------------------- |
| `API_TOKEN`             | Worker-side bearer token secret | `wrangler dev`/env (Worker runtime) | `wrangler secret` (Worker)             |
| `CLOUDFLARE_API_TOKEN`  | CI/CD deployment token          | `.env`                              | GitHub Secrets / CI                    |
| `VITE_API_BASE_URL`     | URL of the API Worker           | `.env` (`http://127.0.0.1:8787`)    | Build Env (`https://api.aperion.cc`)   |
| `VITE_AUTH_TOKEN`       | Client bearer token (baked in)  | `.env`                              | GitHub Actions build env (`API_TOKEN`) |
| `AWS_ACCESS_KEY_ID`     | AWS Identity                    | `~/.aws/credentials`                | `wrangler secret`                      |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret                      | `~/.aws/credentials`                | `wrangler secret`                      |
| `AWS_REGION`            | AWS Region (e.g., us-east-1)    | `~/.aws/config`                     | `wrangler.toml` / Env Var              |

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
- [ ] **CORS**: API allows requests from the Frontend domain.
