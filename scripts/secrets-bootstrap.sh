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

# 2. Application Token (VITE_AUTH_TOKEN / Worker API_TOKEN)
echo ""
echo "--- 2. Application Secrets ---"
echo "We use a single shared bearer token for API authentication."
echo "- Local/CLI/Web build: VITE_AUTH_TOKEN"
echo "- Cloudflare Worker secret: API_TOKEN"
read -s -p "Enter VITE_AUTH_TOKEN (leave blank to generate random or use existing): " auth_token
echo ""

if [ -z "$auth_token" ]; then
    if grep -q "^VITE_AUTH_TOKEN=" .env; then
        auth_token=$(grep "^VITE_AUTH_TOKEN=" .env | cut -d '=' -f2)
        echo "Using existing VITE_AUTH_TOKEN from .env"
    else
        auth_token=$(openssl rand -hex 32)
        echo "🔑 Generated random VITE_AUTH_TOKEN"
    fi
fi

if [ -n "$auth_token" ]; then
    # Remove legacy AUTH_TOKEN if present to avoid ambiguity
    sed -i '/^AUTH_TOKEN=/d' .env

    # Set VITE_AUTH_TOKEN for web app and CLI
    if grep -q "^VITE_AUTH_TOKEN=" .env; then
        sed -i "s|^VITE_AUTH_TOKEN=.*|VITE_AUTH_TOKEN=$auth_token|" .env
    else
        echo "VITE_AUTH_TOKEN=$auth_token" >> .env
    fi

    # Set default VITE_API_BASE_URL if not present
    if ! grep -q "^VITE_API_BASE_URL=" .env; then
        echo "VITE_API_BASE_URL=http://127.0.0.1:8787" >> .env
    fi

    echo "✅ VITE_AUTH_TOKEN updated in .env"

    # Offer to push to Cloudflare
    echo ""
    read -p "Do you want to push API_TOKEN to Cloudflare Workers now? (y/N) " push_cf
    if [[ "$push_cf" =~ ^[Yy]$ ]]; then
        if [ -d "apps/api-worker" ]; then
            echo "🚀 Pushing secret to api-worker..."
            (cd apps/api-worker && echo "$auth_token" | npx wrangler secret put API_TOKEN)
        else
            echo "⚠️  apps/api-worker directory not found, skipping upload."
        fi
    fi
fi

# 3. AWS Configuration
echo ""
echo "--- 3. AWS Configuration ---"
echo "AWS keys should NOT be stored in .env."
echo "We use ~/.aws/credentials for secure storage."

if command -v aws >/dev/null 2>&1; then
    echo "AWS CLI detected."
    read -p "Do you want to run 'aws configure' now? (y/N) " run_aws_config
    if [[ "$run_aws_config" =~ ^[Yy]$ ]]; then
        aws configure
    fi
else
    echo "⚠️  AWS CLI not found (using manual setup)."
    # Default to yes for manual config since it's required
    read -p "Configure AWS credentials now? [Y/n] " manual_aws_config
    manual_aws_config=${manual_aws_config:-y}
    if [[ "$manual_aws_config" =~ ^[Yy]$ ]]; then
        mkdir -p ~/.aws

        read -p "AWS Access Key ID: " aws_key
        read -s -p "AWS Secret Access Key: " aws_secret
        echo ""
        read -p "Default region name [us-east-1]: " aws_region
        aws_region=${aws_region:-us-east-1}

        # Write credentials
        cat > ~/.aws/credentials <<EOF
[default]
aws_access_key_id = $aws_key
aws_secret_access_key = $aws_secret
EOF
        chmod 600 ~/.aws/credentials

        # Write config
        cat > ~/.aws/config <<EOF
[default]
region = $aws_region
output = json
EOF
        echo "✅ AWS credentials written to ~/.aws/credentials"
    fi
fi

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
