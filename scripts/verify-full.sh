#!/bin/bash
set -e

# Define cleanup to ensure we don't leave orphan processes
cleanup() {
  if [ -n "$WORKER_PID" ]; then
    echo "🧹 Stopping background API Worker (PID $WORKER_PID)..."
    kill "$WORKER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "🚀 Starting Full Verification Cycle..."

# 1. Ensure port 8787 is free
if command -v lsof >/dev/null; then
  # Ignore error if no process found (exit code 1 from lsof)
  PID=$(lsof -ti:8787 || true)
  if [ -n "$PID" ]; then
    echo "⚠️  Port 8787 is in use by PID $PID. Killing it..."
    kill -9 "$PID"
  fi
fi

# 2. Start API Worker in background
echo "🔌 Starting API Worker (apps/api-worker)..."
cd apps/api-worker
# Force IPv4 to avoid localhost resolution ambiguity
npx wrangler dev --ip 127.0.0.1 --port 8787 > ../../worker.log 2>&1 &
WORKER_PID=$!
cd ../..

# 3. Wait for health check
echo "⏳ Waiting for API to become reachable..."
MAX_RETRIES=30
COUNT=0
while ! curl -s http://127.0.0.1:8787 > /dev/null; do
  sleep 1
  COUNT=$((COUNT+1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Timed out waiting for API worker to start."
    echo "--- Worker Logs ---"
    cat worker.log
    exit 1
  fi
  echo -n "."
done
echo ""
echo "✅ API is up and listening on 127.0.0.1:8787"

# 4. Run the standard verification
echo "🔍 Running verification suite..."
./scripts/keys-check.sh

echo "🎉 Full verification passed!"
