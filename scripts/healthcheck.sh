#!/bin/bash
set -e

echo "🏥 Running Health Checks..."

# 1. Static Analysis
echo "--- 1. Static Analysis ---"
echo "Running Lint..."
pnpm lint
echo "Running Typecheck..."
pnpm typecheck

# 2. Unit Tests
echo ""
echo "--- 2. Unit Tests ---"
pnpm test

# 3. API Smoke Test (if running)
echo ""
echo "--- 3. API Smoke Test ---"
API_URL=${VITE_API_BASE_URL:-http://127.0.0.1:8787}
if curl -s --head "$API_URL/v1/identity" > /dev/null; then
    echo "✅ API is reachable at $API_URL"
else
    echo "⚠️  API is NOT reachable at $API_URL (Skipping smoke test)"
fi

echo ""
echo "✅ All checks passed!"
