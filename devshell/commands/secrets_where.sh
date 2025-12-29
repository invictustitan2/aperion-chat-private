#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

secrets_default_path() {
  printf '%s' "${HOME}/.config/aperion/cf_access.env"
}

secrets_path() {
  printf '%s' "${APERION_SECRETS_FILE:-$(secrets_default_path)}"
}

# Return 0 if KEY= appears in the file (without printing the line).
file_has_key() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  grep -Eq "^(export[[:space:]]+)?${key}=" "$file" 2>/dev/null
}

# Print 1-based line numbers where KEY= appears in the file (no values).
file_key_lines() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1

  # Output: "L12 L48" (or nothing).
  grep -nE "^(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | cut -d: -f1 | awk '{printf "L%s ",$1}' | sed 's/[[:space:]]*$//'
}

print_presence() {
  local key="$1"

  local in_env='no'
  if [[ -n "${!key-}" ]]; then
    in_env='yes'
  fi

  local dev_vars_file="$repo_root/.dev.vars"
  local env_file="$repo_root/.env"
  local secrets_file
  secrets_file="$(secrets_path)"

  local in_dev_vars='no'
  local in_env_file='no'
  local in_secrets_file='no'

  local dev_vars_lines='' env_lines='' secrets_lines=''

  if file_has_key "$dev_vars_file" "$key"; then
    in_dev_vars='yes'
    dev_vars_lines="$(file_key_lines "$dev_vars_file" "$key" || true)"
  fi

  if file_has_key "$env_file" "$key"; then
    in_env_file='yes'
    env_lines="$(file_key_lines "$env_file" "$key" || true)"
  fi

  if file_has_key "$secrets_file" "$key"; then
    in_secrets_file='yes'
    secrets_lines="$(file_key_lines "$secrets_file" "$key" || true)"
  fi

  printf '%s:\n' "$key"
  printf '  env: %s\n' "$in_env"
  printf '  .dev.vars: %s%s\n' "$in_dev_vars" "${dev_vars_lines:+ (${dev_vars_lines})}"
  printf '  .env: %s%s\n' "$in_env_file" "${env_lines:+ (${env_lines})}"
  printf '  secrets-file: %s%s\n' "$in_secrets_file" "${secrets_lines:+ (${secrets_lines})}"

  # Source precedence reminder (matches devshell_load_repo_dotenv).
  printf '  precedence: .env overrides .dev.vars (and both overwrite existing env)\n'
}

print_header() {
  printf '== Secrets/where (safe; no values) ==\n'
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

  local secrets_file
  secrets_file="$(secrets_path)"
  printf 'APERION_SECRETS_FILE: %s\n' "$secrets_file"
  if [[ -f "$secrets_file" ]]; then
    printf 'Secrets file: present\n'
  else
    printf 'Secrets file: missing\n'
  fi
  printf '\n'
}

main() {
  print_header

  if [[ $# -gt 0 ]]; then
    for key in "$@"; do
      print_presence "$key"
      printf '\n'
    done
    return 0
  fi

  # Default keys (focus on current production/auth problems).
  for key in \
    CLOUDFLARE_API_TOKEN \
    CLOUDFLARE_ACCOUNT_ID \
    APERION_AUTH_MODE \
    CF_ACCESS_TEAM_DOMAIN \
    CF_ACCESS_AUD \
    CF_ACCESS_SERVICE_TOKEN_ID \
    CF_ACCESS_SERVICE_TOKEN_SECRET; do
    print_presence "$key"
    printf '\n'
  done

  printf 'Hint: If cf:access:audit returns 403 Authentication error, update the token value in whichever source shows up above (env/.env/.dev.vars).\n'
}

main "$@"
