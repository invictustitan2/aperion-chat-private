# Rotate Secrets

## Generate New Keys
1. Run `openssl rand -hex 32` to generate a new API token.
2. Run `openssl rand -hex 32` to generate a new JWT secret.

## Update Cloudflare Secrets
1. Run `wrangler secret put API_TOKEN` and paste the new token.
2. Run `wrangler secret put JWT_SECRET` and paste the new secret.

## Update Local Environment
1. Update `.env` with the new keys.
2. Run `./scripts/keys-check.sh` to verify.

## Redeploy
1. Run `npm run deploy` to push changes.
