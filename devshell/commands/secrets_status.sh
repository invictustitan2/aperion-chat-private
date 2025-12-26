#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

dotenv_get() {
  local file="$1"
  local key="$2"

  [[ -f "$file" ]] || { printf '%s' ""; return 0; }

  # Take the last KEY= occurrence to match typical override expectations.
  local line
  line="$(grep -E "^(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  [[ -n "$line" ]] || { printf '%s' ""; return 0; }

  line="${line#export }"
  local value="${line#*=}"

  # Strip surrounding quotes best-effort.
  if [[ "$value" == '"'*'"' ]]; then
    value="${value#\"}"; value="${value%\"}"
  elif [[ "$value" == "'"*"'" ]]; then
    value="${value#\'}"; value="${value%\'}"
  fi

  printf '%s' "$value"
}

key_is_set_somewhere() {
  local key="$1"

  # Priority: real environment, then .dev.vars, then .env
  local env_val="${!key-}"
  if [[ -n "$env_val" ]]; then
    return 0
  fi

  local v
  v="$(dotenv_get "$repo_root/.dev.vars" "$key")"
  if [[ -n "$v" ]]; then
    return 0
  fi

  v="$(dotenv_get "$repo_root/.env" "$key")"
  [[ -n "$v" ]]
}

print_set_unset() {
  local key="$1"
  if key_is_set_somewhere "$key"; then
    printf '%s: set\n' "$key"
  else
    printf '%s: unset\n' "$key"
  fi
}

printf '== Secrets/status (redacted) ==\n'

if [[ -f "$repo_root/.env" ]]; then
  printf '.env: present\n'
else
  printf '.env: missing\n'
fi
if [[ -f "$repo_root/.dev.vars" ]]; then
  printf '.dev.vars: present\n'
else
  printf '.dev.vars: missing\n'
fi

printf '\n'
printf 'Required/primary (Private):\n'
print_set_unset 'CLOUDFLARE_API_TOKEN'
print_set_unset 'CLOUDFLARE_ACCOUNT_ID'
print_set_unset 'APERION_AUTH_MODE'
print_set_unset 'CF_ACCESS_TEAM_DOMAIN'
print_set_unset 'CF_ACCESS_AUD'

printf '\n'
printf 'Worker secrets / optional (Private):\n'
print_set_unset 'API_TOKEN'
print_set_unset 'CF_ACCESS_SERVICE_TOKEN_ID'
print_set_unset 'CF_ACCESS_SERVICE_TOKEN_SECRET'
print_set_unset 'CF_ACCESS_JWKS_TTL_MS'
print_set_unset 'CF_ACCESS_JWT_CLOCK_SKEW_SECONDS'

printf '\n'
printf 'Web build vars (Private):\n'
print_set_unset 'VITE_API_BASE_URL'
print_set_unset 'VITE_AUTH_MODE'

printf '\n'
printf 'CLI legacy vars (used by tools/cli; web must NOT use):\n'
print_set_unset 'VITE_AUTH_TOKEN'
print_set_unset 'AUTH_TOKEN'
print_set_unset 'APERION_API_KEY'

printf '\n'
printf 'Optional sidecars (do not block deploy):\n'
print_set_unset 'AWS_REGION'
print_set_unset 'S3_BUCKET'
print_set_unset 'AWS_KMS_KEY_ID'
print_set_unset 'QDRANT_API_KEY'

printf '\n'
missing_required=()
for k in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID APERION_AUTH_MODE CF_ACCESS_TEAM_DOMAIN CF_ACCESS_AUD; do
  if ! key_is_set_somewhere "$k"; then
    missing_required+=("$k")
  fi
done

if [[ ${#missing_required[@]} -eq 0 ]]; then
  printf 'Deploy-ready (local vars present): yes\n'
  exit 0
fi

printf 'Deploy-ready (local vars present): no\n'
printf 'Manual keys still missing:\n'
for k in "${missing_required[@]}"; do
  printf '  - %s\n' "$k"
done

exit 2
