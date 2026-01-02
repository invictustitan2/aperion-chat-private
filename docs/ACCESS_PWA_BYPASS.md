# Cloudflare Access — PWA Public Asset Bypass

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator
> \
> **Canonical for:** Fixing Access/CORS breakage for public PWA assets

## Why this matters

Browsers fetch PWA assets like `https://chat.aperion.cc/manifest.json` without your service-token headers.
If Cloudflare Access redirects these asset requests (302) to a `*.cloudflareaccess.com` login URL, the browser blocks the response due to CORS (no `Access-Control-Allow-Origin`).

Symptoms:

- `GET https://chat.aperion.cc/manifest.json` -> `302` to `https://<team>.cloudflareaccess.com/...` -> CORS blocked
- PWA installability breaks and the console shows repeated manifest errors

## Operator probe (receipt-backed)

Run:

- `RUN_NETWORK_TESTS=1 ./dev pwa:probe`

Acceptance:

- `PWA.PUBLIC.OK: yes`
- Receipt shows `http_status: 200` for `/manifest.json` and `location` empty

If not OK:

- The command prints:
  `ACTION: Configure Cloudflare Access bypass for /manifest.json (and other static paths); see docs/ACCESS_PWA_BYPASS.md`

## Cloudflare Dashboard steps

### Option A (preferred): Separate Access Application for public assets (BYPASS)

1. Cloudflare Zero Trust Dashboard -> **Access** -> **Applications** -> **Add an application**
2. Choose **Self-hosted**
3. Application domain:
   - `chat.aperion.cc`
4. Application path (create one app per path, or add multiple include rules if supported):
   - `/manifest.json`
   - `/favicon.ico`
   - `/robots.txt`
5. Policies:
   - Add a policy with **Action: BYPASS**
   - Scope it only to these public asset paths
6. Save

Re-check:

- `RUN_NETWORK_TESTS=1 ./dev pwa:probe`

### Option B: Use path-scoped bypass in an existing app (only if your Access UI supports it reliably)

In practice, the most deterministic setup is still a dedicated Access Application for the public asset paths.
If you do use path-scoped bypass inside a broader app, confirm with `./dev pwa:probe` after every change.
