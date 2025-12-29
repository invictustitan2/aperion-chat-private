#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

err() {
  printf 'ERROR: %s\n' "$*" >&2
}

die() {
  err "$*"
  exit 2
}

note() {
  printf '%s\n' "$*"
}

ensure_interactive() {
  if [[ -n "${BATS_VERSION:-}" || -n "${BATS_TEST_FILENAME:-}" ]]; then
    die "secrets:wizard is interactive and is disabled under bats/tests."
  fi
  if [[ ! -t 0 ]]; then
    die "secrets:wizard requires an interactive TTY (run in a terminal)."
  fi
}

is_placeholder() {
  local v="${1:-}"
  local lower
  lower="${v,,}"

  case "$lower" in
    '' | '""' | "''") return 0 ;;
    redacted | redact | xxxxx | xxxx | xxxxxxxx | xxxxxxxxxx) return 0 ;;
    replace_me | replaceme | change_me | changeme | todo) return 0 ;;
  esac

  if [[ "$lower" =~ ^x{4,}$ ]]; then
    return 0
  fi

  return 1
}

file_has_key() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  grep -Eq "^(export[[:space:]]+)?${key}=" "$file" 2>/dev/null
}

file_key_lines() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  grep -nE "^(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | cut -d: -f1 | awk '{printf "L%s ",$1}' | sed 's/[[:space:]]*$//'
}

remove_key_from_file() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0

  local tmp
  tmp="$(mktemp)"
  grep -vE "^(export[[:space:]]+)?${key}=" "$file" >"$tmp" 2>/dev/null || true
  mv "$tmp" "$file"
}

write_kv_dotenv() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$file" ]]; then
    : >"$file"
  fi

  remove_key_from_file "$file" "$key"
  printf '%s="%s"\n' "$key" "$value" >>"$file"
}

ensure_secrets_file() {
  local file="$1"
  local dir
  dir="$(dirname "$file")"
  mkdir -p "$dir"
  if [[ ! -f "$file" ]]; then
    : >"$file"
  fi
  chmod 600 "$file" 2>/dev/null || true
}

write_kv_secrets_file() {
  local file="$1"
  local key="$2"
  local value="$3"

  ensure_secrets_file "$file"
  remove_key_from_file "$file" "$key"
  printf 'export %s="%s"\n' "$key" "$value" >>"$file"
}

prompt_yes_no() {
  local question="$1"
  local default_no="${2:-yes}"

  local prompt='[y/N]'
  if [[ "$default_no" == 'no' ]]; then
    prompt='[Y/n]'
  fi

  while true; do
    printf '%s %s: ' "$question" "$prompt" >/dev/tty
    local ans
    IFS= read -r ans </dev/tty
    ans="${ans,,}"
    if [[ -z "$ans" ]]; then
      if [[ "$default_no" == 'no' ]]; then
        return 0
      fi
      return 1
    fi
    case "$ans" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) printf '%s\n' 'Please answer yes or no.' >/dev/tty ;;
    esac
  done
}

prompt_target() {
  local key="$1"
  local recommended="$2"

  printf '%s\n' "Choose storage target for ${key}:" >/dev/tty
  printf '%s\n' "  1) ${recommended} (recommended)" >/dev/tty
  printf '%s\n' "  2) .env" >/dev/tty
  printf '%s\n' "  3) .dev.vars" >/dev/tty
  printf '%s\n' "  4) secrets-file" >/dev/tty
  printf '%s' 'Select [1-4] (Enter=1): ' >/dev/tty

  local choice
  IFS= read -r choice </dev/tty
  choice="${choice:-1}"

  case "$choice" in
    1) printf '%s' "$recommended" ;;
    2) printf '%s' '.env' ;;
    3) printf '%s' '.dev.vars' ;;
    4) printf '%s' 'secrets-file' ;;
    *) printf '%s' "$recommended" ;;
  esac
}

prompt_value_hidden() {
  local key="$1"
  printf '%s: ' "$key" >/dev/tty
  local v
  IFS= read -r -s v </dev/tty
  printf '\n' >/dev/tty
  printf '%s' "$v"
}

prompt_value_visible() {
  local key="$1"
  printf '%s: ' "$key" >/dev/tty
  local v
  IFS= read -r v </dev/tty
  printf '%s' "$v"
}

validate_key_value() {
  local key="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    die "empty value provided for ${key}"
  fi

  if is_placeholder "$value"; then
    die "${key} looks like a placeholder/redaction"
  fi

  case "$key" in
    CLOUDFLARE_API_TOKEN)
      [[ ${#value} -ge 20 ]] || die "${key} looks too short (len=${#value})"
      ;;
    CLOUDFLARE_ACCOUNT_ID)
      [[ ${#value} -ge 10 ]] || die "${key} looks too short (len=${#value})"
      ;;
    CF_ACCESS_AUD)
      [[ ${#value} -ge 10 ]] || die "${key} looks too short (len=${#value})"
      ;;
    CF_ACCESS_TEAM_DOMAIN)
      [[ "$value" == *.* ]] || die "${key} should look like a domain (example: your-team.cloudflareaccess.com)"
      ;;
    APERION_AUTH_MODE)
      if [[ "$value" != 'access' && "$value" != 'token' ]]; then
        die "${key} must be 'access' or 'token'"
      fi
      ;;
    CF_ACCESS_SERVICE_TOKEN_ID|CF_ACCESS_SERVICE_TOKEN_SECRET|CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET)
      [[ ${#value} -gt 10 ]] || die "${key} looks too short (len=${#value})"
      ;;
  esac
}

recommended_target_for_key() {
  local key="$1"
  case "$key" in
    CLOUDFLARE_API_TOKEN) printf '%s' '.env' ;;
    CLOUDFLARE_ACCOUNT_ID|CF_ACCESS_TEAM_DOMAIN|CF_ACCESS_AUD|APERION_AUTH_MODE) printf '%s' '.dev.vars' ;;
    CF_ACCESS_SERVICE_TOKEN_ID|CF_ACCESS_SERVICE_TOKEN_SECRET|CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET) printf '%s' 'secrets-file' ;;
    *) printf '%s' '.env' ;;
  esac
}

is_secret_key() {
  local key="$1"
  case "$key" in
    CLOUDFLARE_API_TOKEN|CF_ACCESS_SERVICE_TOKEN_SECRET|CF_ACCESS_CLIENT_SECRET) return 0 ;;
    # IDs are also treated as sensitive to reduce accidental leaks.
    CF_ACCESS_SERVICE_TOKEN_ID|CF_ACCESS_CLIENT_ID) return 0 ;;
  esac
  return 1
}

show_sources() {
  local key="$1"

  local env_set='no'
  if [[ -n "${!key-}" ]]; then
    env_set='yes'
  fi

  local env_file="$repo_root/.env"
  local dev_vars_file="$repo_root/.dev.vars"
  local secrets_file="${APERION_SECRETS_FILE:-$HOME/.config/aperion/cf_access.env}"

  local in_env_file='no' in_dev_vars='no' in_secrets='no'
  local env_lines='' dev_lines='' sec_lines=''

  if file_has_key "$env_file" "$key"; then
    in_env_file='yes'
    env_lines="$(file_key_lines "$env_file" "$key" || true)"
  fi
  if file_has_key "$dev_vars_file" "$key"; then
    in_dev_vars='yes'
    dev_lines="$(file_key_lines "$dev_vars_file" "$key" || true)"
  fi
  if file_has_key "$secrets_file" "$key"; then
    in_secrets='yes'
    sec_lines="$(file_key_lines "$secrets_file" "$key" || true)"
  fi

  note "${key}:"
  note "  env: ${env_set}${env_set:+}"  # value not printed
  note "  .env: ${in_env_file}${env_lines:+ (${env_lines})}"
  note "  .dev.vars: ${in_dev_vars}${dev_lines:+ (${dev_lines})}"
  note "  secrets-file: ${in_secrets}${sec_lines:+ (${sec_lines})}"
  note "  precedence in ./dev: .env overrides .dev.vars (and both overwrite env)"
}

apply_update() {
  local key="$1"

  local recommended
  recommended="$(recommended_target_for_key "$key")"

  show_sources "$key"

  if ! prompt_yes_no "Update ${key}?" 'yes'; then
    note "skip: ${key}"
    return 0
  fi

  local target
  target="$(prompt_target "$key" "$recommended")"

  local env_file="$repo_root/.env"
  local dev_vars_file="$repo_root/.dev.vars"
  local secrets_file="${APERION_SECRETS_FILE:-$HOME/.config/aperion/cf_access.env}"

  local target_file=''
  case "$target" in
    .env) target_file="$env_file" ;;
    .dev.vars) target_file="$dev_vars_file" ;;
    secrets-file) target_file="$secrets_file" ;;
    *) target_file="$env_file" ;;
  esac

  if [[ "$target" == 'secrets-file' ]]; then
    note "target: secrets file at ${target_file}"
  else
    note "target: ${target_file#$repo_root/}"
  fi

  if file_has_key "$target_file" "$key"; then
    if ! prompt_yes_no "${key} already exists in ${target}. Overwrite?" 'yes'; then
      note "skip: ${key} (not overwriting)"
      return 0
    fi
  fi

  local value
  if is_secret_key "$key"; then
    value="$(prompt_value_hidden "$key")"
  else
    value="$(prompt_value_visible "$key")"
  fi

  validate_key_value "$key" "$value"

  if [[ "$target" == 'secrets-file' ]]; then
    write_kv_secrets_file "$target_file" "$key" "$value"
  else
    write_kv_dotenv "$target_file" "$key" "$value"
  fi

  note "ok: updated ${key} (value not printed)"

  # Dedupe across repo files/secrets file.
  local duplicates=0
  if [[ "$target_file" != "$env_file" ]] && file_has_key "$env_file" "$key"; then duplicates=1; fi
  if [[ "$target_file" != "$dev_vars_file" ]] && file_has_key "$dev_vars_file" "$key"; then duplicates=1; fi
  if [[ "$target_file" != "$secrets_file" ]] && file_has_key "$secrets_file" "$key"; then duplicates=1; fi

  if [[ "$duplicates" -eq 1 ]]; then
    note "note: ${key} is also present in other locations."
    if prompt_yes_no "Remove duplicates for ${key} from other files?" 'yes'; then
      if [[ "$target_file" != "$env_file" ]]; then remove_key_from_file "$env_file" "$key"; fi
      if [[ "$target_file" != "$dev_vars_file" ]]; then remove_key_from_file "$dev_vars_file" "$key"; fi
      if [[ "$target_file" != "$secrets_file" ]]; then remove_key_from_file "$secrets_file" "$key"; fi
      note "ok: removed duplicate definitions for ${key}"
    else
      note "skip: kept duplicate definitions for ${key}"
    fi
  fi

  # Permissions: keep .env locked down since it holds tokens.
  if [[ "$target" == '.env' ]]; then
    chmod 600 "$env_file" 2>/dev/null || true
  fi

  note ''
}

usage() {
  cat <<'HELP'
Usage:
  ./dev secrets:wizard              # guided setup for common keys
  ./dev secrets:wizard KEY [KEY...] # configure specific keys

Cohesive storage targets:
  - .env: CLOUDFLARE_API_TOKEN (secret-ish; repo-local; gitignored)
  - .dev.vars: CLOUDFLARE_ACCOUNT_ID, APERION_AUTH_MODE, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD (non-secrets)
  - secrets-file (~/.config/aperion/cf_access.env): CF_ACCESS_SERVICE_TOKEN_* (secrets)

Safety:
  - Never prints secret values.
  - Always asks before overwriting.
  - Can optionally remove duplicates across files.
HELP
}

main() {
  ensure_interactive

  if [[ "${1:-}" == '-h' || "${1:-}" == '--help' ]]; then
    usage
    exit 0
  fi

  note "== Secrets/wizard (safe; no values) =="
  note "repo: ${repo_root}"
  note ""

  local keys=()
  if [[ $# -gt 0 ]]; then
    keys=("$@")
  else
    keys=(
      CLOUDFLARE_API_TOKEN
      CLOUDFLARE_ACCOUNT_ID
      APERION_AUTH_MODE
      CF_ACCESS_TEAM_DOMAIN
      CF_ACCESS_AUD
      CF_ACCESS_SERVICE_TOKEN_ID
      CF_ACCESS_SERVICE_TOKEN_SECRET
    )
  fi

  for key in "${keys[@]}"; do
    apply_update "$key"
  done

  note "next: ./dev secrets:where CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_ACCESS_TEAM_DOMAIN CF_ACCESS_AUD"
  note "next: ./dev cf:access:audit --json"
}

main "$@"
