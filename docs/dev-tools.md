# 🛠️ Developer Tools & Debugging Guide

This guide covers the tools available for developing, debugging, and verifying the Aperion Chat project.

## 🐚 The Dev Shell

The `scripts/dev-shell.sh` is your command center. It loads environment variables and provides aliases for common tasks.

**To start:**

```bash
pnpm dev
```

**Commands:**
| Command | Description |
| :--- | :--- |
| `ship` | **The Gold Standard**. Runs typecheck, lint, and all tests. Run this before pushing. |
| `verify` | Same as `ship` but without the "Ready to Ship" message. |
| `e2e` | Runs Playwright End-to-End tests (headless). |
| `test` | Runs Vitest unit and integration tests. |
| `logs` | Tails production logs via `wrangler tail`. |
| `plan` | Prints the Reliability Plan to the terminal. |

## 🐞 The Debug Console

Located at `/errors` in the Web App, the Debug Console is a unified view of:

1.  **Client Runtime Errors**: JavaScript exceptions caught by `window.onerror`.
2.  **API Network Errors**: Failed fetch requests (4xx, 5xx).
3.  **Server Worker Logs**: Backend errors logged via `dev_logs` table (polled every 5s).

**Features:**

- **Filtering**: Toggle between Client, Server, and API logs.
- **Detail View**: formatted stack traces and JSON response bodies.
- **Clear**: Wipes both local storage and the remote `dev_logs` table.

## 🧪 Testing Strategy

See [RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md) for the full architecture.

### Quick Reference

- **Unit Tests**: `pnpm test`
- **E2E Tests**: `pnpm test:e2e`
- **UI Debugging**: `pnpm --filter @aperion/web test:e2e --ui` (Interactive Playwright UI)

## 📦 Database Management

- **Local Migrations**: `pnpm --filter @aperion/api-worker db:migrate:local`
- **Wipe Data**: `wrangler d1 execute aperion-memory --local --command "DELETE FROM episodic; DELETE FROM semantic; DELETE FROM identity;"`
