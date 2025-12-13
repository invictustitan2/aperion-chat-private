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

# Check for AUTH_TOKEN
echo -n "Checking for AUTH_TOKEN... "
if grep -q "AUTH_TOKEN" .env || [ -n "$AUTH_TOKEN" ]; then
  echo "✅ Set."
else
  echo "❌ Not set."
  echo "  Action: Run ./scripts/secrets-bootstrap.sh"
fi

# Check for AWS credentials (Optional)
echo -n "Checking for AWS credentials (Optional)... "
if [ -d ~/.aws ] && [ -f ~/.aws/credentials ]; then
  echo "✅ Found (~/.aws/credentials)."
elif [ -n "$AWS_ACCESS_KEY_ID" ]; then
  echo "⚠️  Found in env vars (not recommended for long-term)."
else
  echo "⚪ Not found (OK if not using Bedrock)."
fi

# Check Wrangler login status
echo -n "Checking Wrangler login status... "
if command -v wrangler >/dev/null 2>&1; then
  if wrangler whoami >/dev/null 2>&1; then
    echo "✅ Logged in."
  else
    echo "❌ Not logged in."
    echo "  Action: Run 'wrangler login' or set CLOUDFLARE_API_TOKEN."
  fi
else
  echo "⚠️ Wrangler not installed."
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

echo "Check complete."
