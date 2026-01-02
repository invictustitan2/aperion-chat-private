# Runbooks

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator
> \
> **Canonical for:** Runbook index and pointers

This directory contains operational guides for maintaining and troubleshooting the system.

## Index

### 🐛 Debugging

- [Debugging Authentication](./auth-debugging.md) - How to diagnose and fix auth issues.
- [Reality Checks (snapshot; receipts-only)](./REALITY_CHECKS.md) - Historical receipts snapshot.
- [Dev Tools](./dev-tools.md) - Recommended VS Code extensions and local environment setup.

### 🚀 Deployment & Operations

- [Production Deploy Runbook](./DEPLOY_PROD_RUN.md) - Exact operator sequence + validation probes.
- [PWA Public Asset Access BYPASS](./ACCESS_PWA_BYPASS.md) - Fix `manifest.json` redirect/CORS break.
- [Deploy to Cloudflare (overview)](./deploy-cloudflare.md) - High-level deployment guide.
- [Rotate Secrets](./runbooks/rotate-secrets.md) - How to safely rotate keys.
- [Recover Failed Deploy](./runbooks/recover-deploy.md) - Rollback/fix a broken deploy.
- [Rebuild Dev Environment](./runbooks/rebuild-dev.md) - Nuke and bootstrap local dev.

### 🔒 Security

- [Cloudflare Permissions](./cloudflare-api-token-permissions.md) - Required scopes for CI/CD tokens.
- [Policy Configuration](./policy.md) - Memory policy engine overview.

---

**Note**: Prefer docs marked **Full (canonical)** if there’s a conflict.
