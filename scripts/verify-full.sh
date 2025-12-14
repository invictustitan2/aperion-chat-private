#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

WORKER_PID=""
LOG_FILE="worker.log"
API_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8787}"
AUTH_TOKEN="${AUTH_TOKEN:-${VITE_AUTH_TOKEN:-}}"

cleanup() {
  if [[ -n "${WORKER_PID}" ]]; then
    echo "🧹 Stopping background API Worker (PID ${WORKER_PID})..."
    kill "${WORKER_PID}" 2>/dev/null || true
    wait "${WORKER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "🚀 Starting Full Verification Cycle..."
echo "API_URL=${API_URL}"

# 1) Ensure port 8787 is free
if command -v lsof >/dev/null 2>&1; then
  PID="$(lsof -ti:8787 || true)"
  if [[ -n "${PID}" ]]; then
    echo "⚠️  Port 8787 is in use by PID ${PID}. Killing it..."
    kill -9 "${PID}" || true
  fi
fi

# 2) Apply local D1 migrations (so worker can actually operate)
echo "🗄️  Applying local D1 migrations..."
( cd apps/api-worker && npx wrangler d1 migrations apply aperion-memory --local )

# 3) Start API Worker in background
echo "🔌 Starting API Worker (apps/api-worker)... logs -> ${LOG_FILE}"
: > "${LOG_FILE}"
(
  cd apps/api-worker
  # Force IPv4 + stable port
  exec npx wrangler dev --ip 127.0.0.1 --port 8787
) > "${LOG_FILE}" 2>&1 &

WORKER_PID="$!"

# 4) Wait until API is usable (not just “port open”)
echo "⏳ Waiting for API to become ready..."
if [[ -z "${AUTH_TOKEN}" ]]; then
  echo "❌ Missing AUTH_TOKEN (or VITE_AUTH_TOKEN)."
  echo "   Run: ./scripts/secrets-bootstrap.sh"
  exit 1
fi

MAX_RETRIES=40
SLEEP_SECS=1
READY=""

for i in $(seq 1 "${MAX_RETRIES}"); do
  # Require a successful authenticated response.
  # If your API returns 200 with empty identity list, that's still success.
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${API_URL}/v1/identity" || true)"

  if [[ "${STATUS}" == "200" ]]; then
    READY="yes"
    break
  fi

  echo -n "."
  sleep "${SLEEP_SECS}"
done

echo ""
if [[ "${READY}" != "yes" ]]; then
  echo "❌ API did not become ready in time (expected 200 from /v1/identity)."
  echo "---- last 200 lines of ${LOG_FILE} ----"
  tail -n 200 "${LOG_FILE}" || true
  exit 1
fi

echo "✅ API is ready and auth is valid."

# 5) Run full verification suite
echo "🔍 Running pnpm verify..."
pnpm verify

echo "🎉 Full verification passed!"
