#!/bin/bash
# Authentication Setup Verification Script
# Verifies that authentication is properly configured across all environments

set -e

echo "🔐 Aperion Chat - Authentication Setup Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    if [ "$1" = "ok" ]; then
        echo -e "${GREEN}✓${NC} $2"
    elif [ "$1" = "warn" ]; then
        echo -e "${YELLOW}⚠${NC} $2"
        ((WARNINGS++))
    else
        echo -e "${RED}✗${NC} $2"
        ((ERRORS++))
    fi
}

# Check 1: Local .env file
echo "1. Checking Local Environment (.env)"
echo "-----------------------------------"

if [ -f .env ]; then
    print_status "ok" ".env file exists"

    if grep -q "VITE_AUTH_TOKEN=" .env; then
        TOKEN_VALUE=$(grep "VITE_AUTH_TOKEN=" .env | cut -d'=' -f2)
        if [ -n "$TOKEN_VALUE" ] && [ "$TOKEN_VALUE" != "your-secure-token-here" ]; then
            print_status "ok" "VITE_AUTH_TOKEN is set"
            TOKEN_LENGTH=${#TOKEN_VALUE}
            if [ $TOKEN_LENGTH -ge 32 ]; then
                print_status "ok" "Token length is adequate ($TOKEN_LENGTH characters)"
            else
                print_status "warn" "Token is short ($TOKEN_LENGTH characters). Consider using a longer token."
            fi
        else
            print_status "error" "VITE_AUTH_TOKEN is not set or using placeholder value"
        fi
    else
        print_status "error" "VITE_AUTH_TOKEN not found in .env"
    fi

    if grep -q "VITE_API_BASE_URL=" .env; then
        API_URL=$(grep "VITE_API_BASE_URL=" .env | cut -d'=' -f2)
        print_status "ok" "VITE_API_BASE_URL is set to: $API_URL"
    else
        print_status "warn" "VITE_API_BASE_URL not found in .env (will use default)"
    fi
else
    print_status "error" ".env file not found. Copy .env.example to .env"
fi

echo ""

# Check 2: Worker Configuration
echo "2. Checking Worker Configuration"
echo "---------------------------------"

if [ -f apps/api-worker/wrangler.toml ]; then
    print_status "ok" "wrangler.toml exists"

    # Check for custom domain configuration
    if grep -q "api.aperion.cc" apps/api-worker/wrangler.toml; then
        print_status "ok" "Custom domain (api.aperion.cc) configured"
    else
        print_status "warn" "Custom domain not configured in wrangler.toml"
    fi
else
    print_status "error" "wrangler.toml not found"
fi

# Check if wrangler is installed
if command -v wrangler &> /dev/null; then
    print_status "ok" "Wrangler CLI is installed"

    # Try to list secrets (requires authentication)
    echo "   Checking Worker secrets..."
    if wrangler secret list --name aperion-api-worker &> /dev/null; then
        if wrangler secret list --name aperion-api-worker 2>/dev/null | grep -q "API_TOKEN"; then
            print_status "ok" "API_TOKEN secret is set in Worker"
        else
            print_status "error" "API_TOKEN secret not found in Worker. Run: wrangler secret put API_TOKEN"
        fi
    else
        print_status "warn" "Cannot verify Worker secrets (authentication may be required)"
    fi
else
    print_status "warn" "Wrangler CLI not installed. Install with: npm install -g wrangler"
fi

echo ""

# Check 3: Test Local API Connection
echo "3. Testing Local API Connection"
echo "--------------------------------"

if [ -f .env ]; then
    source .env

    # Check if local worker is running
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/v1/identity > /dev/null 2>&1; then
        STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/v1/identity)

        if [ "$STATUS_CODE" = "401" ]; then
            print_status "ok" "Worker is running and requires authentication"

            # Test with token
            if [ -n "$VITE_AUTH_TOKEN" ]; then
                AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $VITE_AUTH_TOKEN" http://127.0.0.1:8787/v1/identity)

                if [ "$AUTH_STATUS" = "200" ]; then
                    print_status "ok" "Authentication successful with local token"
                elif [ "$AUTH_STATUS" = "403" ]; then
                    print_status "error" "Authentication failed: Invalid token"
                else
                    print_status "warn" "Unexpected response code: $AUTH_STATUS"
                fi
            fi
        else
            print_status "warn" "Worker returned unexpected status: $STATUS_CODE"
        fi
    else
        print_status "warn" "Local worker not running. Start with: pnpm --filter @aperion/api-worker dev"
    fi
else
    print_status "warn" "Cannot test local API (no .env file)"
fi

echo ""

# Check 4: Production API (if accessible)
echo "4. Testing Production API (Optional)"
echo "-------------------------------------"

if curl -s -o /dev/null -w "%{http_code}" https://api.aperion.cc/v1/identity > /dev/null 2>&1; then
    PROD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.aperion.cc/v1/identity)

    if [ "$PROD_STATUS" = "401" ]; then
        print_status "ok" "Production API is accessible and requires authentication"
    elif [ "$PROD_STATUS" = "200" ]; then
        print_status "warn" "Production API is accessible without authentication (security issue!)"
    else
        print_status "warn" "Production API returned status: $PROD_STATUS"
    fi
else
    print_status "warn" "Production API not accessible (may not be deployed yet)"
fi

echo ""

# Check 5: CORS Configuration
echo "5. Checking CORS Configuration"
echo "-------------------------------"

if grep -q "Access-Control-Allow-Origin" apps/api-worker/src/index.ts; then
    print_status "ok" "CORS headers configured in Worker"

    # Check if using wildcard (security issue)
    if grep -q '"Access-Control-Allow-Origin": "\*"' apps/api-worker/src/index.ts; then
        print_status "warn" "CORS allows all origins (*). Consider restricting to specific domains."
    else
        print_status "ok" "CORS is restricted to specific origins"
    fi
else
    print_status "warn" "CORS configuration not found in Worker"
fi

echo ""

# Summary
echo "=================================================="
echo "Summary"
echo "=================================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your authentication setup is properly configured."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Authentication is configured but there are some recommendations above."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    echo ""
    echo "Quick fixes:"
    echo "  1. Generate token: node scripts/generate-api-token.ts"
    echo "  2. Copy .env.example to .env and add the token"
    echo "  3. Set Worker secret: wrangler secret put API_TOKEN"
    echo "  4. Start local worker: pnpm --filter @aperion/api-worker dev"
    exit 1
fi
