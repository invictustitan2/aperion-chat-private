#!/usr/bin/env bash
set -e

usage() {
  echo "Usage: $0 [--e2e]"
  exit 1
}

RUN_E2E=false
for arg in "$@"; do
  case $arg in
    --e2e) RUN_E2E=true ;;
    *) usage ;;
  esac
done

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

# 3. E2E Tests (Optional)
if [ "$RUN_E2E" = true ]; then
  echo ""
  echo "--- 3. E2E Tests ---"
  pnpm test:e2e
fi

# 4. API Smoke Test (if running)
echo ""
echo "--- 4. API Smoke Test ---"
API_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8787}"
# Check if port is open
if command -v lsof >/dev/null 2>&1 && lsof -ti:8787 >/dev/null 2>&1; then
    echo "🔌 API detected on port 8787. Checking health..."
    # We use --fail to exit with error on 400+ (except we handle it manually to be nicer)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/v1/identity")

    # 200 OK or 401 Unauthorized (if no token sent) means it's running and handling requests
    if [[ "$HTTP_CODE" =~ ^(200|401)$ ]]; then
         echo "✅ API is reachable (Status: $HTTP_CODE)."
    else
         echo "⚠️  API is running but returned status $HTTP_CODE."
         exit 1
    fi
else
    echo "ℹ️  API not running (skipping smoke test)."
fi

echo ""
echo "✅ All checks passed!"
