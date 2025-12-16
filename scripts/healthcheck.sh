#!/usr/bin/env bash
set -e

usage() {
  echo "Usage: $0 [--e2e] [--prod]"
  echo "  --e2e    Run E2E tests"
  echo "  --prod   Run production API smoke tests"
  exit 1
}

RUN_E2E=false
RUN_PROD=false
for arg in "$@"; do
  case $arg in
    --e2e) RUN_E2E=true ;;
    --prod) RUN_PROD=true ;;
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

# 4. Local API Smoke Test (if running)
echo ""
echo "--- 4. Local API Smoke Test ---"
API_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8787}"
# Check if port is open
if command -v lsof >/dev/null 2>&1 && lsof -ti:8787 >/dev/null 2>&1; then
    echo "🔌 API detected on port 8787. Checking health..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/v1/identity")

    if [[ "$HTTP_CODE" =~ ^(200|401)$ ]]; then
         echo "✅ API is reachable (Status: $HTTP_CODE)."
    else
         echo "⚠️  API is running but returned status $HTTP_CODE."
         exit 1
    fi
else
    echo "ℹ️  Local API not running (skipping local smoke test)."
fi

# 5. Production API Smoke Tests (Optional)
if [ "$RUN_PROD" = true ]; then
  echo ""
  echo "--- 5. Production API Smoke Tests ---"

  PROD_API_URL="${PROD_API_URL:-https://api.aperion.cc}"
  AUTH_TOKEN="${PROD_AUTH_TOKEN:-}"

  echo "Testing production API: $PROD_API_URL"

  # Test health endpoint (no auth required)
  echo -n "  Checking / ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_API_URL/")
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✅ OK"
  else
    echo "❌ Failed (Status: $HTTP_CODE)"
    exit 1
  fi

  # Test identity endpoint (requires auth)
  if [ -n "$AUTH_TOKEN" ]; then
    echo -n "  Checking /v1/identity ... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      "$PROD_API_URL/v1/identity")
    if [[ "$HTTP_CODE" =~ ^(200|404)$ ]]; then
      echo "✅ OK"
    else
      echo "❌ Failed (Status: $HTTP_CODE)"
      exit 1
    fi

    echo -n "  Checking /v1/episodic ... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      "$PROD_API_URL/v1/episodic")
    if [[ "$HTTP_CODE" =~ ^(200|204)$ ]]; then
      echo "✅ OK"
    else
      echo "❌ Failed (Status: $HTTP_CODE)"
      exit 1
    fi

    echo -n "  Checking /v1/receipts ... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      "$PROD_API_URL/v1/receipts")
    if [[ "$HTTP_CODE" =~ ^(200|204)$ ]]; then
      echo "✅ OK"
    else
      echo "❌ Failed (Status: $HTTP_CODE)"
      exit 1
    fi

    echo "✅ All production endpoints healthy!"
  else
    echo "⚠️  PROD_AUTH_TOKEN not set. Skipping authenticated endpoint tests."
  fi
fi

echo ""
echo "✅ All checks passed!"

