# Security Policy

> **Status:** Full
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** In-repo security guardrails and expectations

## Secret handling (repo-enforced)

- Never commit secrets.
- Templates live in `.env.example` and `apps/api-worker/.dev.vars.example`.
- Local secret files are expected to be untracked (gitignored), e.g. `.env` / `.dev.vars`.
- CI/CD uses GitHub Actions secrets.

Evidence:

- Guardrails: `scripts/guard-prod-secrets.mjs`, `scripts/guard-config-drift.mjs`
- Auth setup verification: `scripts/verify-auth-setup.sh`

## Auth perimeter (intended contract)

- Production auth is expected to be Cloudflare Access (`APERION_AUTH_MODE=access`).
- The web UI is Access-session-only and must not ship browser-baked bearer tokens (e.g. no `VITE_AUTH_TOKEN` in web source).

Evidence:

- Worker required vars list (comment contract): `apps/api-worker/wrangler.toml`
- Drift guard for `VITE_AUTH_TOKEN`: `scripts/guard-config-drift.mjs`

## Threat model (high-level)

- Asset: chat history, memory, receipts, logs.
- Primary risk: unauthorized access to the API surfaces.
- In-repo mitigation: auth middleware gates endpoints and is exercised by tests.

Evidence:

- Auth middleware tests: `apps/api-worker/test/auth.test.ts`
- Integration smoke: `apps/api-worker/test/index.test.ts`
