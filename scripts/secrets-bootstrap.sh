#!/bin/bash
set -e

# 0. Security Hygiene: Clean up compromised/legacy patterns
echo "🧹 Cleaning up environment..."
if [ -f .env ]; then
    # Remove AWS keys from .env (should be in ~/.aws/credentials)
    sed -i '/AWS_ACCESS_KEY_ID/d' .env
    sed -i '/AWS_SECRET_ACCESS_KEY/d' .env
    # Remove GitHub PATs from .env (should use gh auth login)
    sed -i '/GITHUB_TOKEN/d' .env
    echo "✅ Removed legacy AWS/GitHub keys from .env"
fi

# Ensure .env exists with strict permissions
touch .env
chmod 600 .env

echo "🔐 Secrets Bootstrap"
echo "----------------------------------------------------------------"
echo "This script sets up the 'Cloudflare-first' secret structure."
echo "AWS is treated as an optional sidecar."
echo "----------------------------------------------------------------"
echo ""

# 1. Cloudflare API Token (for Wrangler deployments)
echo "--- 1. Cloudflare Configuration ---"
echo "Required for deploying Workers and managing D1/KV."
echo "Create one at: https://dash.cloudflare.com/profile/api-tokens"
echo "Permissions: Workers Scripts (Edit), D1 (Edit), KV (Edit), Account Settings (Read)"
echo ""
read -s -p "Enter CLOUDFLARE_API_TOKEN (leave blank to keep existing): " cf_token
echo ""

if [ -n "$cf_token" ]; then
    if grep -q "^CLOUDFLARE_API_TOKEN=" .env; then
        sed -i "s|^CLOUDFLARE_API_TOKEN=.*|CLOUDFLARE_API_TOKEN=$cf_token|" .env
    else
        echo "CLOUDFLARE_API_TOKEN=$cf_token" >> .env
    fi
    echo "✅ CLOUDFLARE_API_TOKEN updated in .env"
fi

# 2. Application Secrets (AUTH_TOKEN)
echo ""
echo "--- 2. Application Secrets ---"
echo "We use a shared AUTH_TOKEN for service-to-service communication."
read -s -p "Enter AUTH_TOKEN (leave blank to generate random): " auth_token
echo ""

if [ -z "$auth_token" ] && ! grep -q "^AUTH_TOKEN=" .env; then
    auth_token=$(openssl rand -hex 32)
    echo "�� Generated random AUTH_TOKEN"
fi

if [ -n "$auth_token" ]; then
    # Update .env
    if grep -q "^AUTH_TOKEN=" .env; then
        sed -i "s|^AUTH_TOKEN=.*|AUTH_TOKEN=$auth_token|" .env
    else
        echo "AUTH_TOKEN=$auth_token" >> .env
    fi
    echo "✅ AUTH_TOKEN updated in .env"

    # Offer to push to Cloudflare
    echo ""
    read -p "Do you want to push AUTH_TOKEN to Cloudflare Workers now? (y/N) " push_cf
    if [[ "$push_cf" =~ ^[Yy]$ ]]; then
        if [ -d "apps/api-worker" ]; then
            echo "🚀 Pushing secret to api-worker..."
            echo "$auth_token" | npx wrangler secret put AUTH_TOKEN --cwd apps/api-worker
        else
            echo "⚠️  apps/api-worker directory not found, skipping upload."
        fi
    fi
fi

# 3. AWS Configuration (Optional Sidecar)
echo ""
echo "--- 3. AWS Configuration (Optional) ---"
echo "AWS keys should NOT be stored in .env."
echo "If you need AWS (e.g. for Bedrock), please run:"
echo "  $ aws configure"
echo ""
echo "This keeps your keys in ~/.aws/credentials where they belong."

# 4. GitHub Configuration
echo ""
echo "--- 4. GitHub Configuration ---"
echo "We use the GitHub CLI for authentication."
echo "If you haven't already, please run:"
echo "  $ gh auth login"

echo ""
echo "🔒 Final Permission Check:"
ls -l .env

echo ""
echo "🎉 Secrets setup complete!"
