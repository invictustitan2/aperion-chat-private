#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq > /dev/null 2>&1; then
  echo "jq is required for this script" >&2
  exit 1
fi

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

WORKER_NAME=${WORKER_NAME:-aperion-api-worker}
WORKER_HOSTNAME=${WORKER_HOSTNAME:-api.aperion.cc}
WORKER_ENVIRONMENT=${WORKER_ENVIRONMENT:-production}
WORKER_ZONE_NAME=${WORKER_ZONE_NAME:-aperion.cc}

echo "Preparing custom domain ${WORKER_HOSTNAME} for ${WORKER_NAME}..."

# 1. Get Zone ID for the domain
echo "Resolving Zone ID for ${WORKER_ZONE_NAME}..."
ZONE_RESPONSE=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/zones?name=${WORKER_ZONE_NAME}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

if [[ "$(echo "$ZONE_RESPONSE" | jq -r '.success')" != "true" ]]; then
  echo "❌ Failed to resolve Zone ID. Response:" >&2
  if [[ "$(echo "$ZONE_RESPONSE" | jq -r '.errors[0].code // empty')" == "10000" ]]; then
    echo "   Hint: CLOUDFLARE_API_TOKEN is not authorized for zone lookups." >&2
    echo "   Ensure the token includes Zone:Read for ${WORKER_ZONE_NAME}." >&2
  fi
  echo "$ZONE_RESPONSE" | jq '.' >&2 || echo "$ZONE_RESPONSE" >&2
  exit 1
fi

ZONE_ID=$(echo "$ZONE_RESPONSE" | jq -r '.result[0].id')
echo "✓ Found Zone ID: ${ZONE_ID}"

# 2. Check for existing DNS records for the hostname
echo "Checking for existing DNS records for ${WORKER_HOSTNAME}..."
DNS_RESPONSE=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${WORKER_HOSTNAME}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

if [[ "$(echo "$DNS_RESPONSE" | jq -r '.success')" != "true" ]]; then
  echo "❌ Failed to list DNS records. Response:" >&2
  if [[ "$(echo "$DNS_RESPONSE" | jq -r '.errors[0].code // empty')" == "10000" ]]; then
    echo "   Hint: CLOUDFLARE_API_TOKEN is not authorized to read DNS records in this zone." >&2
    echo "   Ensure the token includes DNS:Read for ${WORKER_ZONE_NAME}." >&2
    echo "   If you want this script to delete conflicting records, also grant DNS:Edit." >&2
  fi
  echo "$DNS_RESPONSE" | jq '.' >&2 || echo "$DNS_RESPONSE" >&2
  exit 1
fi

RECORD_COUNT=$(echo "$DNS_RESPONSE" | jq -r '.result | length')

if [[ "$RECORD_COUNT" -gt 0 ]]; then
  echo "⚠️ Found ${RECORD_COUNT} existing DNS record(s) for ${WORKER_HOSTNAME}. Deleting to prevent conflicts..."

  # Delete each conflicting record
  echo "$DNS_RESPONSE" | jq -r '.result[].id' | while read -r RECORD_ID; do
    echo "Deleting DNS record ${RECORD_ID}..."
    DELETE_RESPONSE=$(curl -sS -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

    if [[ "$(echo "$DELETE_RESPONSE" | jq -r '.success')" != "true" ]]; then
      echo "❌ Failed to delete DNS record. Response:" >&2
      echo "$DELETE_RESPONSE" | jq '.' >&2 || echo "$DELETE_RESPONSE" >&2
      exit 1
    fi
    echo "✓ Deleted DNS record ${RECORD_ID}"
  done
else
  echo "✓ No conflicting DNS records found."
fi

echo "✅ Domain preparation complete. Wrangler will now be able to configure the route."
