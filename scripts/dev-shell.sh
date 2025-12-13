#!/bin/bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "🚀 Aperion Dev Shell"
echo "================================================================"

# Node
echo -n "📦 Node: "
node --version

# PNPM
echo -n "📦 PNPM: "
pnpm --version

# Wrangler
echo -n "🔥 Wrangler: "
if command -v wrangler &> /dev/null; then
    wrangler --version
else
    echo "Not found (install via pnpm)"
fi

# AWS (Optional)
echo -n "☁️  AWS CLI: "
if command -v aws &> /dev/null; then
    aws --version | cut -d ' ' -f 1
else
    echo "Not installed (Optional)"
fi

# Git
echo -n "🐙 Git: "
git --version | cut -d ' ' -f 3

# Tailscale (Optional)
echo -n "🔒 Tailscale: "
if command -v tailscale &> /dev/null; then
    tailscale version | head -n 1
else
    echo "Not installed (Optional)"
fi

echo "================================================================"
echo "✅ Environment loaded. Strict mode enabled."
echo ""
