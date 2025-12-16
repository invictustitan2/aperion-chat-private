# Cloudflare API Token Permissions

This document lists the required permissions for the `CLOUDFLARE_API_TOKEN` used in CI/CD workflows.

## Current Token Permissions

### Account-Level Permissions

- **Registrar: Domains** - Read
- **Workers R2 SQL** - Read
- **Workers Agents Configuration** - Edit
- **Containers** - Edit
- **Workers Observability** - Edit
- **Browser Rendering** - Edit
- **Load Balancing: Account Load Balancers** - Edit
- **DNS Settings** - Edit
- **Workers Builds Configuration** - Edit
- **Workers Pipelines** - Edit
- **Workers AI** - Edit
- **Queues** - Edit
- **Vectorize** - Edit
- **Hyperdrive** - Edit
- **Access: Custom Pages** - Edit
- **D1** - Edit
- **Cloudflare Pages** - Edit
- **Workers R2 Storage** - Edit
- **Workers Tail** - Read
- **Logs** - Read
- **Zero Trust** - Read
- **Workers KV Storage** - Edit
- **Workers Scripts** - Edit ✅ (Required for worker deployment)
- **Load Balancing: Monitors And Pools** - Edit
- **Account Settings** - Read

### Zone-Level Permissions (All zones)

- **DNS Settings** - Edit
- **Custom Pages** - Edit
- **Origin Rules** - Edit
- **Zone Settings** - Edit
- **Zone** - Edit
- **Workers Routes** - Edit ✅ (Required for custom domain routing)
- **SSL and Certificates** - Edit
- **Logs** - Edit
- **Page Rules** - Edit
- **DNS** - Edit

## Required Permissions for Deployment

### Minimum Required

These permissions are essential for the deployment workflows to function:

1. **Workers Scripts:Edit** (Account) - Deploy worker code
2. **Workers Routes:Edit** (Zone) - Create routes for custom domains
3. **D1:Edit** (Account) - Apply database migrations
4. **Cloudflare Pages:Edit** (Account) - Deploy web application

### Recommended

These permissions enable additional features and better debugging:

1. **Workers Tail:Read** (Account) - View worker logs
2. **Workers Observability:Edit** (Account) - Configure monitoring
3. **DNS:Edit** (Zone) - Manage DNS records for custom domains
4. **Workers KV Storage:Edit** (Account) - Manage KV namespaces
5. **Queues:Edit** (Account) - Manage worker queues
6. **Vectorize:Edit** (Account) - Manage vector indexes
7. **Workers R2 Storage:Edit** (Account) - Manage R2 buckets
8. **Workers AI:Edit** (Account) - Configure AI bindings

## Token Configuration

The API token is stored as a GitHub Secret:

- **Secret Name**: `CLOUDFLARE_API_TOKEN`
- **Used In**:
  - `.github/workflows/deploy-api.yml`
  - `.github/workflows/deploy-web.yml`
  - `.github/workflows/ci.yml` (for validation)

## Security Notes

1. **Scope**: Token has access to all zones in the account
2. **Expiration**: Check token expiration date regularly
3. **Rotation**: Rotate token periodically for security
4. **Audit**: Review token usage in Cloudflare dashboard

## Troubleshooting

If deployment fails with authentication errors:

1. Verify token hasn't expired
2. Check required permissions are still granted
3. Ensure token is correctly set in GitHub Secrets
4. Review Cloudflare API token audit logs

## Related Documentation

- [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Workers Deployment](https://developers.cloudflare.com/workers/wrangler/ci-cd/)
- [Pages Deployment](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
