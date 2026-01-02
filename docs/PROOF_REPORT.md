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

- Receipt (doctor): `receipts/reality.2026-01-02T020958Z.cf-doctor.json`
- Receipt (Access probe, browser surface): `receipts/reality.2026-01-02T020958Z.access-probe.browser.txt`
- Receipt (WS probe, browser surface): `receipts/reality.2026-01-02T020958Z.ws-probe.browser.txt`
- Receipt (PWA assets probe): `receipts/pwa-probe.20260102-021015Z.json` (also copied to `receipts/pwa-probe.latest.json`)

## What is proven by these receipts

### 1) Surfaces and tooling are configured and readable

- `cf:doctor` is green and confirms the repo’s intended surfaces:
  - Pages: `chat.aperion.cc`
  - Worker: `api.aperion.cc`

Proof: `receipts/reality.2026-01-02T020958Z.cf-doctor.json`

### 2) Browser surface `/api` is Access-protected, and service-token automation works

- Without a service token, requests are redirected to Access login (`302`).
- With a service token, `GET /api/v1/identity` is `200`.

Proof: `receipts/reality.2026-01-02T020958Z.access-probe.browser.txt`

### 3) Browser-surface WebSocket upgrade succeeds (service token)

- WS upgrade to `https://chat.aperion.cc/api/v1/ws` succeeds with `101` when using a service token.

Proof: `receipts/reality.2026-01-02T020958Z.ws-probe.browser.txt`

### 4) Public PWA assets are currently blocked by Access (problem state)

- `GET https://chat.aperion.cc/manifest.json` redirects to Access login (`302`).
- This breaks installability and causes browser console manifest errors.

Proof: `receipts/pwa-probe.20260102-021015Z.json`

Remediation runbook: `docs/ACCESS_PWA_BYPASS.md`

## How to regenerate (create new proofs)

Run from repo root:

- `./dev cf:doctor --json | tee receipts/reality.<UTC>.cf-doctor.json`
- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser | tee receipts/reality.<UTC>.access-probe.browser.txt`
- `RUN_NETWORK_TESTS=1 ./dev ws:probe --surface browser | tee receipts/reality.<UTC>.ws-probe.browser.txt`
- `RUN_NETWORK_TESTS=1 ./dev pwa:probe` (writes `receipts/pwa-probe.*.json` + `receipts/pwa-probe.latest.json`)
