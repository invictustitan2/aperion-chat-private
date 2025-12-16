# Authentication Verification & Debugging

These steps help diagnose the "VITE_AUTH_TOKEN is missing" and CORS failures seen in production logs.

## Quick checklist

1. Ensure `.env` (local) or Cloudflare Pages project settings (prod) defines `VITE_AUTH_TOKEN` and `VITE_API_BASE_URL`.
2. The token must match the API worker configuration. If you rotated the key, redeploy the Pages site so the new token is baked into the client.
3. `VITE_API_BASE_URL` should point to the Worker domain that allows your Page origin; mismatched hosts usually surface as CORS preflight failures.
4. Restart `pnpm dev` after updating env vars so Vite reloads them.

## Local verification

```bash
# Confirm env values are visible to the web app build
cat .env | grep VITE_

# Run the existing full verification script (starts the worker, checks auth against /v1/identity)
./scripts/verify-full.sh
```

## UI-level check

Open **Settings → Authentication Debug** in the web app and click **Run auth self-test**. The panel shows:

- Whether your `VITE_AUTH_TOKEN` was injected into the build (token is truncated for safety).
- The API base URL the client will call.
- Success/failure details for an authenticated `/v1/identity` request, which surfaces missing tokens or CORS issues immediately.

Use these results to align the client and Worker configuration before re-running end-to-end flows.
