# Rebuild Local Dev Env

## Clean Install
1. Run `rm -rf node_modules` in root.
2. Run `pnpm install`.

## Reset Database
1. Run `wrangler d1 migrations apply aperion-db --local`.
2. Run `aperion seed ./seeds/dev-identity.yaml`.

## Verify
1. Run `aperion verify`.
2. Start dev server with `npm run dev`.
