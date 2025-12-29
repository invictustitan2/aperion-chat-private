#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

note() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

redact_kv_stream() {
  sed -E 's/=(.*)$/=<REDACTED>/'
}

print_repo_definitions() {
  note "-- Repo definitions (key presence only) --"

  if [[ -f "$repo_root/.env" ]]; then
    note ".env: present"
    rg -n '^(export\s+)?(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|APERION_AUTH_MODE|CF_ACCESS_TEAM_DOMAIN|CF_ACCESS_AUD)=' "$repo_root/.env" 2>/dev/null | redact_kv_stream || true
  else
    note ".env: missing"
  fi

  if [[ -f "$repo_root/.dev.vars" ]]; then
    note ".dev.vars: present"
    rg -n '^(export\s+)?(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|APERION_AUTH_MODE|CF_ACCESS_TEAM_DOMAIN|CF_ACCESS_AUD)=' "$repo_root/.dev.vars" 2>/dev/null | redact_kv_stream || true
  else
    note ".dev.vars: missing"
  fi

  note ""
}

print_effective_sources() {
  note "-- Effective sources (inside current ./dev process env) --"
  "$repo_root/devshell/commands/secrets_where.sh" "$repo_root" \
    CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID APERION_AUTH_MODE CF_ACCESS_TEAM_DOMAIN CF_ACCESS_AUD \
    CF_ACCESS_SERVICE_TOKEN_ID CF_ACCESS_SERVICE_TOKEN_SECRET \
    CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET || true
  note ""
}

print_outside_override_checks() {
  note "-- Outside override checks (recommended manual reruns) --"

  note "1) Bypass repo dotenv (detects values exported by your shell/IDE):"
  note "   DEV_LOAD_DOTENV=0 ./dev secrets:where CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_ACCESS_TEAM_DOMAIN CF_ACCESS_AUD APERION_AUTH_MODE"

  note "2) Fresh empty environment (proves nothing is forced by the OS itself):"
  note "   env -i HOME=\"$HOME\" PATH=\"$PATH\" DEV_LOAD_DOTENV=0 ./dev secrets:where CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID"

  note "3) Search your shell config for accidental exports (names only):"
  note "   rg -n 'CLOUDFLARE_API_TOKEN|CF_ACCESS_(SERVICE_TOKEN|CLIENT)_(ID|SECRET)|CF_ACCESS_AUD|CF_ACCESS_TEAM_DOMAIN' ~/.bashrc ~/.zshrc ~/.profile ~/.config/fish/config.fish 2>/dev/null || true"

  note ""
}

print_auth_checks() {
  note "-- Cloudflare API token auth sanity (safe patterns) --"
  note "Avoid passing tokens via argv. Prefer stdin config with curl -K -"
  note "Example (token in env; header provided via stdin config):"
  note "  cat <<EOF | curl -sS -K -"
  note "  url = \"https://api.cloudflare.com/client/v4/user/tokens/verify\""
  note "  header = \"Authorization: <token from CLOUDFLARE_API_TOKEN>\""
  note "EOF"
  note ""
}

main() {
  note "== Secrets/doctor (safe; no values) =="
  note "repo: ${repo_root}"
  note ""

  if ! command -v rg >/dev/null 2>&1; then
    warn "rg (ripgrep) not found; some checks will be skipped"
  fi

  print_repo_definitions
  print_effective_sources
  print_outside_override_checks
  print_auth_checks

  note "next: If cf:access:audit returns 403 code=10000 Authentication error, run secrets:wizard and ensure CLOUDFLARE_API_TOKEN is stored only in .env (recommended) and not also exported globally."
}

main "$@"
