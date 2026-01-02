# Proof Report (Evidence-Backed)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator
> \
> **Canonical for:** Linking project-state claims to concrete evidence

This report exists to prevent “docs drift”: any important operational claim should be provable via **code/config/tests/receipts**.

## Evidence timestamp

This report is backed by receipts generated on **2026-01-02**.

- Receipt (doctor): `receipts/reality.2026-01-02T05:29:31Z.cf-doctor.json`
- Receipt (Access probe, browser surface): `receipts/access-probe.browser.20260102-052132Z.txt`
- Receipt (WS probe, browser surface): `receipts/ws-probe.browser.20260102-052140Z.txt`
- Receipt (WS proof, browser surface): `receipts/ws-proof.browser.20260102-051558Z.json`
- Receipt (PWA assets probe): `receipts/pwa-probe.20260102-051154Z.json` (also copied to `receipts/pwa-probe.latest.json`)

Historical problem-state receipt (PWA blocked):

- `receipts/pwa-probe.20260102-021015Z.json`

## What is proven by these receipts

### 1) Surfaces and tooling are configured and readable

- `cf:doctor` is green and confirms the repo’s intended surfaces:
  - Pages: `chat.aperion.cc`
  - Worker: `api.aperion.cc`

Proof: `receipts/reality.2026-01-02T05:29:31Z.cf-doctor.json`

### 2) Browser surface `/api` is Access-protected, and service-token automation works

- Without a service token, requests are redirected to Access login (`302`).
- With a service token, `GET /api/v1/identity` is `200`.

Proof: `receipts/reality.2026-01-02T020958Z.access-probe.browser.txt`

Proof (latest, receipt-first tooling): `receipts/access-probe.browser.20260102-052132Z.txt`

### 3) Browser-surface WebSocket upgrade succeeds (service token)

- WS upgrade to `https://chat.aperion.cc/api/v1/ws` succeeds with `101` when using a service token.

Proof: `receipts/reality.2026-01-02T020958Z.ws-probe.browser.txt`

Proof (latest, receipt-first tooling): `receipts/ws-probe.browser.20260102-052140Z.txt`

Data-plane proof (latest): `receipts/ws-proof.browser.20260102-051558Z.json`

### 4) Public PWA assets are public (fixed state)

- `GET https://chat.aperion.cc/manifest.json` is `200` with no Access redirect.
- `GET https://chat.aperion.cc/favicon.ico` is `200` with no Access redirect.
- `GET https://chat.aperion.cc/robots.txt` is `200` with no Access redirect.

Proof: `receipts/pwa-probe.20260102-051154Z.json`

Remediation runbook (if this regresses): `docs/ACCESS_PWA_BYPASS.md`

## How to regenerate (create new proofs)

Run from repo root:

- `./dev cf:doctor --json | tee receipts/reality.<UTC>.cf-doctor.json`
- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser` (writes `receipts/access-probe.browser.*.txt` + `receipts/access-probe.browser.latest.txt`)
- `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser` (writes `receipts/ws-probe.browser.*.txt` + `receipts/ws-probe.browser.latest.txt`)
- `RUN_NETWORK_TESTS=1 ./dev pwa:probe` (writes `receipts/pwa-probe.*.json` + `receipts/pwa-probe.latest.json`)
