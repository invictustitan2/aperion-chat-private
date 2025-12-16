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
OVERRIDE_EXISTING_DNS_RECORD=${OVERRIDE_EXISTING_DNS_RECORD:-true}

normalize_bool() {
  case "${1,,}" in
    true|1|yes|y) echo true ;;
    *) echo false ;;
  esac
}

OVERRIDE_FLAG=$(normalize_bool "$OVERRIDE_EXISTING_DNS_RECORD")

echo "Ensuring custom domain ${WORKER_HOSTNAME} (env=${WORKER_ENVIRONMENT}) for ${WORKER_NAME}..."

# Validate API token has necessary permissions
echo "Validating API token permissions..."
WHOAMI_RESPONSE=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

if [[ "$(echo "$WHOAMI_RESPONSE" | jq -r '.success')" != "true" ]]; then
  echo "❌ API token validation failed. Response:" >&2
  echo "$WHOAMI_RESPONSE" | jq '.' >&2 || echo "$WHOAMI_RESPONSE" >&2
  echo "" >&2
  echo "Note: Custom domain is also configured via routes in wrangler.toml" >&2
  echo "The worker will still be accessible at ${WORKER_HOSTNAME}" >&2
  exit 1
fi

echo "✓ API token validated"

REQUEST_BODY=$(jq -n \
  --arg hostname "$WORKER_HOSTNAME" \
  --arg service "$WORKER_NAME" \
  --arg environment "$WORKER_ENVIRONMENT" \
  --arg zone_name "$WORKER_ZONE_NAME" \
  --argjson override_existing_dns_record "$OVERRIDE_FLAG" \
  '{hostname: $hostname, service: $service, environment: $environment, zone_name: $zone_name, override_existing_dns_record: $override_existing_dns_record}')

API_URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains"

HTTP_RESPONSE=$(curl -sS -X POST "$API_URL" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

if [[ "$(echo "$HTTP_RESPONSE" | jq -r '.success')" != "true" ]]; then
  echo "❌ Cloudflare custom domain provisioning failed. Response:" >&2
  echo "$HTTP_RESPONSE" | jq '.' >&2 || echo "$HTTP_RESPONSE" >&2
  echo "" >&2
  echo "Note: Custom domain is also configured via routes in wrangler.toml" >&2
  echo "The worker will still be accessible at ${WORKER_HOSTNAME}" >&2
  exit 1
fi

HOSTNAME_RESULT=$(echo "$HTTP_RESPONSE" | jq -r '.result.hostname // .result.name // "unknown"')
STATUS_RESULT=$(echo "$HTTP_RESPONSE" | jq -r '.result.status // "unknown"')

echo "✅ Custom domain ensured: ${HOSTNAME_RESULT} (status=${STATUS_RESULT})."
