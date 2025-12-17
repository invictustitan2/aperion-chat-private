#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
    set -a
    source .env
    set +a
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
echo "� Tip: Use 'ship' to commit, push, and watch CI."
echo "🐚 Spawning shell..."
echo ""

# Additional Dev Shell Commands (Functions exported to subshell)
function ship() {
    echo '🚀 Running verification pipeline...'
    pnpm typecheck && pnpm lint && pnpm test && echo '✅ Ready to Ship!'
}
export -f ship

function verify() {
    pnpm typecheck && pnpm lint && pnpm test
}
export -f verify

function test_suite() {
    pnpm test
}
export -f test_suite

function e2e() {
    pnpm test:e2e
}
export -f e2e

function logs() {
    wrangler tail --name aperion-api-worker
}
export -f logs

function db_local() {
    wrangler d1 execute aperion-memory --local --command "$@"
}
export -f db_local

function plan() {
    cat docs/RELIABILITY_PLAN.md
}
export -f plan

function ci_watch() {
    gh run watch
}
export -f ci_watch

function ci_list() {
    gh run list
}
export -f ci_list

function prev_url() {
    # Tries to find the latest comment from github-actions with a preview link
    gh pr view --json comments --jq '.comments[].body' | grep -o 'https://.*\.pages\.dev' | tail -n 1
}
export -f prev_url

# Helper function
function help_dev() {
    echo "🛠️  Dev Shell Commands:"
    echo "  verify      - Run typecheck, lint, and unit tests"
    echo "  ship        - Full verification before git push"
    echo "  e2e         - Run Playwright E2E tests"
    echo "  logs        - Tail production logs (requires login)"
    echo "  plan        - View Reliability Plan"
    echo "  test_suite  - Run Vitest"
    echo "  ci_watch    - Watch current GitHub Action run"
    echo "  ci_list     - List recent GitHub Action runs"
    echo "  prev_url    - Get latest Preview Deployment URL from PR"
}
export -f help_dev

export PATH="$PWD/scripts:$PATH"

echo "================================================================"
echo "✅ Environment loaded. Strict mode enabled."
echo "ℹ️  Type 'help_dev' to see available commands."
echo "🐚 Spawning shell..."
echo ""


# after: source .env
export AZURE_FOUNDRY_API_KEY AZURE_FOUNDRY_API_VERSION
export AZURE_FOUNDRY_COVERAGE_URL AZURE_FOUNDRY_DEV_FAST_URL AZURE_FOUNDRY_DEV_DEEP_URL
export AZURE_OPENAI_API_KEY OPENAI_API_KEY


# Spawn a new shell with the environment variables
exec "${SHELL:-bash}"
