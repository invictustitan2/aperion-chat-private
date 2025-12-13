# Recover from a Bad Deploy

## Identify Issue
1. Check logs via `wrangler tail`.
2. Check `aperion verify` output.

## Rollback
1. Run `wrangler rollback` to revert to the previous version.
2. Verify the rollback with `aperion verify`.

## Fix and Redeploy
1. Fix the issue in the codebase.
2. Run tests locally.
3. Deploy again.
