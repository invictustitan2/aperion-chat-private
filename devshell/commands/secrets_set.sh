#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 2
}

note() {
  printf '%s\n' "$*"
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

ensure_tty() {
  # Avoid hanging in non-interactive contexts (CI, bats).
  if [[ -n "${BATS_VERSION:-}" || -n "${BATS_TEST_FILENAME:-}" ]]; then
    die "secrets:set is interactive and is disabled under bats/tests."
  fi
  if [[ ! -t 0 ]]; then
    die "secrets:set requires an interactive TTY (run in a terminal)."
  fi
}

write_dotenv_kv() {
  local file="$1"
  local key="$2"
  local value="$3"

  # Create if missing and lock down permissions.
  if [[ ! -f "$file" ]]; then
    : >"$file"
  fi
  chmod 600 "$file" 2>/dev/null || true

  # Remove existing lines for KEY= (or export KEY=) without printing values.
  # Keep everything else unchanged.
  local tmp
  tmp="$(mktemp)"
  grep -vE "^(export[[:space:]]+)?${key}=" "$file" >"$tmp" 2>/dev/null || true

  # Append at end.
  printf '%s="%s"\n' "$key" "$value" >>"$tmp"

  mv "$tmp" "$file"
}

usage() {
  cat <<'HELP'
Usage:
  ./dev secrets:set CLOUDFLARE_API_TOKEN

This prompts for the secret (hidden input) and writes it to repo-local .env.
No secret values are printed.
HELP
}

main() {
  local key="${1:-}"
  if [[ -z "$key" || "$key" == "-h" || "$key" == "--help" ]]; then
    usage
    exit 2
  fi

  if [[ "$key" != "CLOUDFLARE_API_TOKEN" ]]; then
    die "unsupported key: ${key} (only CLOUDFLARE_API_TOKEN is supported)"
  fi

  ensure_tty

  note "This will update repo-local .env (gitignored)"
  note "Enter ${key} (input hidden), then press Enter."
  printf '%s: ' "$key" >&2

  local token
  IFS= read -r -s token
  printf '\n' >&2

  if [[ -z "${token}" ]]; then
    die "empty value provided"
  fi
  if is_placeholder "$token"; then
    die "value looks like a placeholder/redaction"
  fi
  if [[ ${#token} -lt 20 ]]; then
    die "value looks too short (len=${#token}); did you paste the full token?"
  fi

  write_dotenv_kv "$repo_root/.env" "$key" "$token"

  note "ok: wrote ${key} to .env (value not printed)"
  note "next: run ./dev cf:access:audit"
}

main "$@"
