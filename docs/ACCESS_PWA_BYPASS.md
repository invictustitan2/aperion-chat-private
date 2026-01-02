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

This repo’s PWA assets (source of truth):

- `apps/web/public/manifest.json`
- `apps/web/public/icon-192.png`
- `apps/web/public/icon-512.png`

Other static paths currently probed (and should not redirect to Access):

- `/favicon.ico`
- `/robots.txt`

If Access blocks _any_ of these, PWA installability will be degraded even if the HTML loads.

## Operator probe (receipt-backed)

Run:

- `RUN_NETWORK_TESTS=1 ./dev pwa:probe`

Acceptance:

- `PWA.PUBLIC.OK: yes`
- Receipt shows `http_status: 200` for `/manifest.json` and `location` empty

Additional expectation (not currently probed by `pwa:probe`, but required for a working PWA):

- `GET https://chat.aperion.cc/icon-192.png` returns `200` (not `302` to Access)
- `GET https://chat.aperion.cc/icon-512.png` returns `200` (not `302` to Access)

If not OK:

- The command prints:
  `ACTION: Configure Cloudflare Access bypass for /manifest.json (and other static paths); see docs/ACCESS_PWA_BYPASS.md`

## Cloudflare Dashboard steps

This section is intentionally explicit about _every_ required knob in the UI, because
partial configuration is the most common cause of continued `302` redirects.

Important Access behavior (relevant to debugging):

- Access applications are **deny by default** unless a request matches a policy.
- Policy evaluation order matters: **Bypass** and **Service Auth** policies are evaluated
  first, **top-to-bottom as shown in the UI**, before Allow/Block policies.

### Option A (preferred): Dedicated self-hosted Access application(s) for public assets (BYPASS)

This is the most deterministic approach because it keeps the bypass scope extremely tight
and avoids accidental bypass of `/api/*`.

You may create either:

- One Access application per public asset path (most explicit), or
- A single Access application with multiple **public hostnames** (if your UI supports
  multiple hostnames/paths in one app reliably).

The critical requirement is: **only** the exact public asset paths are bypassed.

#### A1) Create the application

1. Cloudflare Zero Trust Dashboard -> **Access** -> **Applications** -> **Add an application**
2. Choose **Self-hosted**
3. **Application name** (example): `Aperion Chat — PWA Public Assets`
4. **Session duration**: keep default (not security-relevant for BYPASS)
5. **Add public hostname**
   - **Domain**: `chat.aperion.cc`
   - **Path**: `/manifest.json`
   - Save the public hostname
6. Repeat **Add public hostname** for the other required public assets:

- `chat.aperion.cc` + `/favicon.ico`
- `chat.aperion.cc` + `/robots.txt`
- `chat.aperion.cc` + `/icon-192.png`
- `chat.aperion.cc` + `/icon-512.png`

7. Continue through the wizard pages:
   - **Identity providers**: select the same IdPs as the main `chat.aperion.cc/*` app (even
     though BYPASS won’t use them; some UI flows require at least one IdP selection).
   - **App Launcher**: off/hidden is fine (public assets are not a user-facing app)
   - **Block page**: irrelevant for BYPASS
   - **Advanced settings**: leave defaults unless you have a known reason to change them
     (do not enable service-token settings here; this app is public assets only).

#### A2) Add the BYPASS policy

Inside the new Access application:

1. Go to **Policies** for the application.
2. **Add a policy** (or attach a reusable policy).
3. Set:
   - **Action**: `BYPASS`
   - **Include rule**: `Everyone` → `Everyone`
   - **Require**: none
   - **Exclude**: none
4. Ensure this BYPASS policy is at the top of the application’s policy list.
5. Save.

#### A3) Confirm it’s not accidentally bypassing more

Double-check that the public hostname list for this app includes only:

- `/manifest.json`
- `/favicon.ico`
- `/robots.txt`
- `/icon-192.png`
- `/icon-512.png`

If you add a broader path (for example `/` or `/*`), you risk bypassing authentication
for the entire UI.

Re-check:

- `RUN_NETWORK_TESTS=1 ./dev pwa:probe`

Also verify icons:

- `curl -sS -D - -o /dev/null https://chat.aperion.cc/icon-192.png | head -n 5`
- `curl -sS -D - -o /dev/null https://chat.aperion.cc/icon-512.png | head -n 5`

Both should show `HTTP/2 200` (or `HTTP/1.1 200`) and no `location:` header.

### Option B: Path-scoped BYPASS inside the existing `chat.aperion.cc/*` app (less preferred)

In practice, the most deterministic setup is still a dedicated Access Application for the public asset paths.
If you do use path-scoped bypass inside a broader app, confirm with `./dev pwa:probe` after every change.

If using Option B, the two common failure modes are:

- The BYPASS policy exists, but is below an Allow/Block policy (policy order).
- The path match is broader than intended (security risk) or doesn’t actually match the asset
  request path (continued `302`).

## Troubleshooting (evidence-first)

If `./dev pwa:probe` still reports redirects:

1. Run `RUN_NETWORK_TESTS=1 ./dev pwa:probe` and open the receipt JSON.
2. Confirm which paths are redirecting and where they redirect.
3. Run `./dev cf:access:audit --surface browser` to verify which Access application is
   currently matching `chat.aperion.cc/*` and whether it has a BYPASS policy.
4. If you use a service token for automation, correlate with:
   - `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser`

Interpretation hints:

- `302` to `*.cloudflareaccess.com/cdn-cgi/access/login/...` means Access is still enforcing
  an interactive login flow for that path.
- For public assets, the goal is **`200` without any Access redirect**, not `401`.
