# Rotate Secrets

## Access Service Token (Optional)

If you use an Access service token for automation/smoke tests:

1. Create a new service token in Cloudflare Zero Trust.
2. Update Worker secrets:
   - `wrangler secret put CF_ACCESS_SERVICE_TOKEN_ID`
   - `wrangler secret put CF_ACCESS_SERVICE_TOKEN_SECRET`

3. Update GitHub Actions secrets with the same values.

## Update Local Environment

1. Run `./scripts/keys-check.sh` to verify.

## Redeploy

1. Redeploy the API Worker and web app.
