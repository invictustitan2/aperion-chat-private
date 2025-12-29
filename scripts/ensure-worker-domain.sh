#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq > /dev/null 2>&1; then
  echo "jq is required for this script" >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
repo_root="$(cd -- "${script_dir}/.." >/dev/null 2>&1 && pwd -P)"

# Load repo-local env (same safe parser used by ./dev).
# This makes .dev.vars/.env work for this script when run from repo context.
# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
if [[ "${DEV_LOAD_DOTENV:-1}" != "0" ]]; then
  devshell_load_repo_dotenv "${repo_root}" || true
fi

APPLY='no'
WORKER_HOSTNAME_ARG=''
for arg in "$@"; do
  case "$arg" in
    --apply)
      APPLY='yes'
      ;;
    -h|--help)
      echo "Usage: $0 [hostname] [--apply]" >&2
      echo "  Default is dry-run (no changes). Use --apply to delete conflicting DNS records." >&2
      exit 2
      ;;
    --*)
      echo "ERROR: unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      # First positional arg is hostname.
      if [[ -z "$WORKER_HOSTNAME_ARG" ]]; then
        WORKER_HOSTNAME_ARG="$arg"
      fi
      ;;
  esac
done

cf_api() {
  local url="$1"
  local request_method="${2:-GET}"
  cat <<EOF | curl -sS -K -
url = "${url}"
request = "${request_method}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
EOF
}

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

WORKER_NAME=${WORKER_NAME:-aperion-api-worker}
WORKER_HOSTNAME=${WORKER_HOSTNAME_ARG:-${WORKER_HOSTNAME:-api.aperion.cc}}
WORKER_ENVIRONMENT=${WORKER_ENVIRONMENT:-production}
WORKER_ZONE_NAME=${WORKER_ZONE_NAME:-aperion.cc}

echo "DRY_RUN: $([[ "$APPLY" == 'yes' ]] && echo no || echo yes)"
echo "Preparing custom domain ${WORKER_HOSTNAME} for ${WORKER_NAME}..."

# 1. Get Zone ID for the domain
echo "Resolving Zone ID for ${WORKER_ZONE_NAME}..."
ZONE_RESPONSE="$(cf_api "https://api.cloudflare.com/client/v4/zones?name=${WORKER_ZONE_NAME}" GET)"

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
DNS_RESPONSE="$(cf_api "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${WORKER_HOSTNAME}" GET)"

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
  echo "Found ${RECORD_COUNT} existing DNS record(s) for ${WORKER_HOSTNAME}."
  echo "Would delete record IDs:"
  echo "$DNS_RESPONSE" | jq -r '.result[].id'

  if [[ "$APPLY" != "yes" ]]; then
    echo "NOTE: Dry-run mode. Re-run with --apply to delete the conflicting DNS records."
    exit 0
  fi

  echo "Applying: deleting conflicting DNS records..."
  echo "$DNS_RESPONSE" | jq -r '.result[].id' | while read -r RECORD_ID; do
    echo "Deleting DNS record ${RECORD_ID}..."
    DELETE_RESPONSE="$(cf_api "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" DELETE)"

    if [[ "$(echo "$DELETE_RESPONSE" | jq -r '.success')" != "true" ]]; then
      echo "Failed to delete DNS record. Response:" >&2
      echo "$DELETE_RESPONSE" | jq '.' >&2 || echo "$DELETE_RESPONSE" >&2
      exit 1
    fi
    echo "Deleted DNS record ${RECORD_ID}"
  done
else
  echo "✓ No conflicting DNS records found."
fi

echo "✅ Domain preparation complete. Wrangler will now be able to configure the route."
