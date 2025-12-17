#!/bin/bash

echo "Checking environment keys and configuration..."

# Check for Cloudflare API token env var
echo -n "Checking for CLOUDFLARE_API_TOKEN... "
if grep -q "CLOUDFLARE_API_TOKEN" .env || [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  echo "✅ Set."
else
  echo "❌ Not set."
  echo "  Action: Run ./scripts/secrets-bootstrap.sh"
fi

# Check for VITE_AUTH_TOKEN
echo -n "Checking for VITE_AUTH_TOKEN... "
if grep -q "VITE_AUTH_TOKEN" .env || [ -n "$VITE_AUTH_TOKEN" ]; then
  echo "✅ Set."
else
  echo "❌ Not set."
  echo "  Action: Run ./scripts/secrets-bootstrap.sh"
fi

# Check for AWS credentials
echo -n "Checking for AWS credentials... "
if [ -d ~/.aws ] && [ -f ~/.aws/credentials ]; then
  if grep -q "aws_access_key_id" ~/.aws/credentials; then
    echo "✅ Found (~/.aws/credentials)."
  else
    echo "❌ Found but invalid (~/.aws/credentials)."
    echo "  Action: Run ./scripts/secrets-bootstrap.sh"
  fi
elif [ -n "$AWS_ACCESS_KEY_ID" ]; then
  echo "⚠️  Found in env vars (not recommended for long-term)."
else
  echo "❌ Not found."
  echo "  Action: Run ./scripts/secrets-bootstrap.sh"
fi

# Check Wrangler login status
echo -n "Checking Wrangler login status... "
WRANGLER_CMD="wrangler"
if ! command -v wrangler >/dev/null 2>&1; then
  WRANGLER_CMD="pnpm exec wrangler"
fi

if $WRANGLER_CMD whoami >/dev/null 2>&1; then
  echo "✅ Logged in."
else
  echo "❌ Not logged in."
  echo "  Action: Run '$WRANGLER_CMD login' or set CLOUDFLARE_API_TOKEN."
fi

# Check GitHub CLI status
echo -n "Checking GitHub CLI status... "
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    echo "✅ Logged in."
  else
    echo "❌ Not logged in."
    echo "  Action: Run 'gh auth login'."
  fi
else
  echo "⚠️ GitHub CLI (gh) not installed."
fi

echo ""
echo "Running deep verification with @aperion/cli..."
pnpm --filter @aperion/cli build >/dev/null 2>&1
node tools/cli/dist/index.js verify

echo "Check complete."
