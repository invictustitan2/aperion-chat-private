# Runbooks

This directory contains operational guides for maintaining and troubleshooting the system.

## Index

### 🐛 Debugging

- [Debugging Authentication](../auth-debugging.md) - How to diagnose and fix auth issues.
- [Dev Tools](../dev-tools.md) - Recommended VS Code extensions and local environment setup.

### 🚀 Deployment & Operations

- [Deploy to Cloudflare](../deploy-cloudflare.md) - Step-by-step production deployment.
- [Rotate Secrets](./rotate-secrets.md) - How to safely rotate API tokens and keys.
- [Recover Failed Deploy](./recover-deploy.md) - Steps to rollback or fix a broken deployment.
- [Rebuild Dev Environment](./rebuild-dev.md) - How to nuke and bootstrap the local dev environment.

### 🔒 Security

- [Cloudflare Permissions](../cloudflare-api-token-permissions.md) - Required scopes for CI/CD tokens.
- [Policy Configuration](../policy.md) - How to adjust the memory policy engine.

---

**Note**: Always verify runbooks against the latest codebase versions.
