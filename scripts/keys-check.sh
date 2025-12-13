#!/bin/bash

echo "Checking environment keys and configuration..."

# Check for Git SSH key (ed25519)
echo -n "Checking for Git SSH key (ed25519)... "
if [ -f ~/.ssh/id_ed25519 ]; then
  echo "✅ Found."
else
  echo "❌ Not found."
  echo "  Action: Generate one using: ssh-keygen -t ed25519 -C \"your_email@example.com\""
fi

# Check for Cloudflare API token env var
echo -n "Checking for CLOUDFLARE_API_TOKEN... "
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  echo "✅ Set."
else
  echo "❌ Not set."
  echo "  Action: Set CLOUDFLARE_API_TOKEN in your .env or shell environment."
fi

# Check for AWS credentials
echo -n "Checking for AWS credentials... "
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "✅ Env vars set."
elif [ -d ~/.aws ]; then
  echo "✅ ~/.aws directory found."
else
  echo "❌ Not found."
  echo "  Action: Configure AWS credentials via env vars or 'aws configure'."
fi

# Check Wrangler login status
echo -n "Checking Wrangler login status... "
if command -v wrangler >/dev/null 2>&1; then
  if wrangler whoami >/dev/null 2>&1; then
    echo "✅ Logged in."
  else
    echo "❌ Not logged in."
    echo "  Action: Run 'wrangler login'."
  fi
else
  echo "⚠️ Wrangler not installed (will be installed via package.json later)."
fi

echo "Check complete."
