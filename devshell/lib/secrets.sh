#!/usr/bin/env bash

# devshell/lib/secrets.sh
#
# Safe to source under strict mode. Does not change shell flags.
# Never prints secret values.

aperion_secrets_default_path() {
  printf '%s' "${HOME}/.config/aperion/cf_access.env"
}

aperion__repo_root_from_this_file() {
  local lib_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  (cd "${lib_dir}/../.." && pwd -P)
}

aperion_secrets_path() {
  printf '%s' "${APERION_SECRETS_FILE:-$(aperion_secrets_default_path)}"
}

aperion__secrets_is_placeholder() {
  local v="$1"
  local lower
  lower="${v,,}"

  case "$lower" in
  '' | '""' | "''") return 0 ;;
  redacted | redact | xxxxx | xxxx | xxxxxxxx | xxxxxxxxxx) return 0 ;;
  replace_me | replaceme | change_me | changeme | todo) return 0 ;;
  esac

  # Runs of x/X (case-insensitive).
  if [[ "$lower" =~ ^x{4,}$ ]]; then
    return 0
  fi

  return 1
}

aperion__secrets_print_create_file_instructions() {
  local secrets_file="$1"
  local secrets_dir
  secrets_dir="$(dirname "$secrets_file")"

  local repo_root
  repo_root="$(aperion__repo_root_from_this_file)"

  cat >&2 <<EOF

Missing secrets file:
  ${secrets_file}

Create it with the following commands (copy/paste):

  mkdir -p "${secrets_dir}"
  cat > "${secrets_file}" <<'CF_ACCESS_ENV'
export CF_ACCESS_SERVICE_TOKEN_ID="REPLACE_ME"
export CF_ACCESS_SERVICE_TOKEN_SECRET="REPLACE_ME"
CF_ACCESS_ENV
  chmod 600 "${secrets_file}"

Then re-run:
  ${repo_root}/devshell/devshell secrets check

Override path example:
  APERION_SECRETS_FILE=/path/to/cf_access.env ${repo_root}/devshell/devshell secrets check
EOF
}

aperion__secrets_env_is_valid() {
  local id secret
  id="${CF_ACCESS_SERVICE_TOKEN_ID-}"
  secret="${CF_ACCESS_SERVICE_TOKEN_SECRET-}"

  [[ -n "$id" ]] || return 1
  [[ -n "$secret" ]] || return 1

  aperion__secrets_is_placeholder "$id" && return 1
  aperion__secrets_is_placeholder "$secret" && return 1

  [[ ${#id} -gt 10 ]] || return 1
  [[ ${#secret} -gt 10 ]] || return 1

  return 0
}

aperion_secrets_load() {
  local secrets_file
  secrets_file="$(aperion_secrets_path)"

  # Prefer environment if already valid; do not require a file.
  if aperion__secrets_env_is_valid; then
    return 0
  fi

  if [[ ! -f "$secrets_file" ]]; then
    aperion__secrets_print_create_file_instructions "$secrets_file"
    return 1
  fi

  # Permissions warning (do not auto-fix)
  local perm
  perm="$(stat -c '%a' "$secrets_file" 2>/dev/null || echo '')"
  if [[ -n "$perm" ]]; then
    local last_two
    last_two="${perm: -2}"
    if [[ "$last_two" != "00" ]]; then
      printf 'WARN: secrets file permissions look permissive (mode=%s). Recommend: chmod 600 "%s"\n' "$perm" "$secrets_file" >&2
    fi
  fi

  # Source safely under nounset: the file may not define everything.
  local _old_nounset=0
  if [[ $- == *u* ]]; then
    _old_nounset=1
    set +u
  fi

  # shellcheck disable=SC1090
  source "$secrets_file"

  if [[ $_old_nounset -eq 1 ]]; then
    set -u
  fi
}

aperion_secrets_validate() {
  local secrets_file
  secrets_file="$(aperion_secrets_path)"

  local id secret
  id="${CF_ACCESS_SERVICE_TOKEN_ID-}"
  secret="${CF_ACCESS_SERVICE_TOKEN_SECRET-}"

  local missing=()
  if [[ -z "$id" ]]; then
    missing+=("CF_ACCESS_SERVICE_TOKEN_ID")
  fi
  if [[ -z "$secret" ]]; then
    missing+=("CF_ACCESS_SERVICE_TOKEN_SECRET")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    printf 'ERROR: required variables are missing/empty after checking environment and secrets file (if needed):\n' >&2
    printf '  - %s\n' "${missing[@]}" >&2
    printf 'Secrets file (if used): %s\n' "$secrets_file" >&2
    return 1
  fi

  if aperion__secrets_is_placeholder "$id"; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_ID looks like a placeholder/redaction.\n' >&2
    printf 'Hint: set env vars or update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  if aperion__secrets_is_placeholder "$secret"; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_SECRET looks like a placeholder/redaction.\n' >&2
    printf 'Hint: set env vars or update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  # Common footgun: values accidentally include literal quote characters.
  # Example bad value: CF_ACCESS_SERVICE_TOKEN_ID='"abc123..."'
  # This will be sent to Cloudflare Access verbatim and rejected.
  if [[ "$id" =~ ^\".*\"$ || "$id" =~ ^\'.*\'$ ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_ID appears to include literal quote characters.\n' >&2
    printf 'Hint: In %s, set it like: export CF_ACCESS_SERVICE_TOKEN_ID="<client_id>" (without extra quoting).\n' "$secrets_file" >&2
    return 1
  fi

  if [[ "$secret" =~ ^\".*\"$ || "$secret" =~ ^\'.*\'$ ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_SECRET appears to include literal quote characters.\n' >&2
    printf 'Hint: In %s, set it like: export CF_ACCESS_SERVICE_TOKEN_SECRET="<client_secret>" (without extra quoting).\n' "$secrets_file" >&2
    return 1
  fi

  if [[ "$id" =~ [[:space:]] ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_ID contains whitespace; this is almost certainly misconfigured.\n' >&2
    printf 'Hint: Update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  if [[ "$secret" =~ [[:space:]] ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_SECRET contains whitespace; this is almost certainly misconfigured.\n' >&2
    printf 'Hint: Update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  if [[ ${#id} -le 10 ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_ID is too short (len=%s); must be > 10.\n' "${#id}" >&2
    printf 'Hint: set env vars or update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  if [[ ${#secret} -le 10 ]]; then
    printf 'ERROR: CF_ACCESS_SERVICE_TOKEN_SECRET is too short (len=%s); must be > 10.\n' "${#secret}" >&2
    printf 'Hint: set env vars or update secrets file: %s\n' "$secrets_file" >&2
    return 1
  fi

  printf 'OK: CF Access service token present (ID len=%s, SECRET len=%s)\n' "${#id}" "${#secret}"
}
