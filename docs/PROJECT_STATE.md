# Project State (Current Reality)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator (solo) + Dev
> \
> **Canonical for:** What’s live, what to trust, what to run

## What this repo is

Aperion Chat Private is a single-user, memory-backed chat system deployed on Cloudflare:

- **Web UI:** Cloudflare Pages (`https://chat.aperion.cc`)
- **API Worker:** Cloudflare Workers (`https://api.aperion.cc`)
- **Same-origin browser API mount (Path B):** `https://chat.aperion.cc/api/*`

The system assumes **Cloudflare Access** is the production auth boundary.

## Current production contracts (the ones that matter)

### Browser contract (canonical)

- REST: `https://chat.aperion.cc/api/v1/*` (same-origin; no CORS)
- WS: `wss://chat.aperion.cc/api/v1/ws`
- Web build behavior:
  - If `VITE_API_BASE_URL` is unset in production builds, the web app defaults to `/api`.
  - Production builds must not use a cross-origin `https://api.aperion.cc` base.

### Tooling / back-compat contract

- REST: `https://api.aperion.cc/v1/*`
- WS: `wss://api.aperion.cc/v1/ws`

This surface remains useful for scripts/tools and as a rollback lever.

## Auth model

- **Humans (browser):** authenticate via Cloudflare Access session on `chat.aperion.cc`.
- **Automation (smoke tests):** optional Cloudflare Access Service Token.
- **Worker:** verifies Access identity (JWKS). Production should run with `APERION_AUTH_MODE=access`.

Key operator implication: if the browser is not authenticated (or is redirected to Access), the app will fail in ways that can look like “CORS” or opaque WS closes.

## Receipts-first operational discipline

Most networked devshell commands are **opt-in** behind `RUN_NETWORK_TESTS=1` and write receipts under `./receipts/`.

This repo treats “operator evidence” as a first-class artifact:

- Prefer deterministic probes (`./dev access:probe`, `./dev ws:probe`, `./dev pwa:probe`) over manual browser guessing.
- Avoid secrets in argv and logs.

Proof report (evidence-backed): `docs/PROOF_REPORT.md`

## Production incident gotchas (known failure modes)

- **Public assets blocked by Access:** if `manifest.json` (or similar) is protected, the browser may be redirected to the Access login domain and then blocked by CORS.
  - Canonical runbook: `docs/ACCESS_PWA_BYPASS.md`
  - Probe: `RUN_NETWORK_TESTS=1 ./dev pwa:probe`

  Current status (evidence-backed, 2026-01-02): public assets are **public** (no Access redirect).
  - Proof: `receipts/pwa-probe.20260102-051154Z.json`

- **WS close code 1006:** commonly happens when the browser is not actually authenticated (or is being redirected).
  - The web client performs an identity preflight before opening WS and logs a single operator-grade diagnostic line when it refuses to connect.

## “Where is the truth?” (canonical docs)

- **Deploy execution steps:** `docs/DEPLOY_PROD_RUN.md`
- **API endpoints:** `docs/API_REFERENCE.md`
- **Environment variables:** `docs/environment-matrix.md`
- **Doc status meanings:** `docs/DOC_STATUS_RUBRIC.md`

## Testing / verification gates

Local gate (CI-grade):

- `./dev verify:ci`

Networked validations (opt-in):

- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser`
- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface api`

## Major subsystems (status summary)

- **Path B (same-origin /api):** Implemented and treated as the current browser contract.
- **Preferences API (`/v1/preferences/*`):** Implemented; includes `theme`.
- **PWA public asset Access bypass:** Operator runbook + deterministic probe exist.

## Proofs (do not trust docs without evidence)

Evidence-backed snapshot (2026-01-02):

- `docs/PROOF_REPORT.md`
- `receipts/reality.2026-01-02T05:29:31Z.cf-doctor.json`
- `receipts/access-probe.browser.20260102-052132Z.txt`
- `receipts/ws-probe.browser.20260102-052140Z.txt`
- `receipts/ws-proof.browser.20260102-051558Z.json`
- `receipts/pwa-probe.20260102-051154Z.json`

## If you only remember one thing

Production browser traffic should be same-origin under `/api`. If anything suggests “browser should call https://api.aperion.cc”, treat it as legacy/out-of-date unless an explicit rollback is underway.
