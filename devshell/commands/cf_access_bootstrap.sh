#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
# shellcheck source=devshell/lib/surfaces.sh
source "${repo_root}/devshell/lib/surfaces.sh"

surface='api'
base_url_override=''
host_override=''
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --surface)
      surface="${2:-}"
      shift 2
      ;;
    --base-url)
      base_url_override="${2:-}"
      shift 2
      ;;
    --host)
      host_override="${2:-}"
      shift 2
      ;;
    *)
      devshell_die "unknown arg: $1"
      ;;
  esac
done

resolved_host=''
if [[ -n "$host_override" ]]; then
  resolved_host="$host_override"
else
  BASE_URL="$(devshell_api_base_url_resolve "$surface" "$base_url_override")"
  mapfile -t _url_parts < <(devshell_split_url_host_and_path_prefix "$BASE_URL")
  resolved_host="${_url_parts[0]:-}"
fi

[[ -n "$resolved_host" ]] || devshell_die "failed to determine host"

export APERION_ACCESS_APP_HOST="$resolved_host"

cf_api_get() {
  local url="$1"

  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN is required in the environment (not printed)." >&2
    return 2
  fi

  cat <<EOF | curl -sS -K -
url = "${url}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
EOF
}

json_get() {
  # Usage: json_get '<json>' '<js expression returning a string or JSON>'
  local json="$1"
  local expr="$2"

  node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8'); const data=JSON.parse(input); const out=(${expr}); if (out===undefined||out===null) process.exit(3); if (typeof out==='string') process.stdout.write(out); else process.stdout.write(JSON.stringify(out));" <<<"$json"
}

print_template_block() {
  cat <<'EOF'

Add these to .dev.vars (safe; no secrets):

CLOUDFLARE_ACCOUNT_ID=REPLACE_ME
APERION_AUTH_MODE=access
CF_ACCESS_TEAM_DOMAIN=REPLACE_ME
CF_ACCESS_AUD=REPLACE_ME
EOF
}

main() {
  echo "== Cloudflare Access bootstrap (safe; no secrets) =="

  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN is missing in the environment." >&2
    print_template_block
    echo >&2
    echo "Hint: export CLOUDFLARE_API_TOKEN, then re-run: ./dev cf:access:bootstrap" >&2
    exit 2
  fi

  local account_id
  if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    account_id="$CLOUDFLARE_ACCOUNT_ID"
  else
    local accounts_json
    accounts_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts")"

    local ok
    ok="$(json_get "$accounts_json" "data && data.success")" || true
    if [[ "$ok" != "true" ]]; then
      echo "ERROR: Cloudflare accounts API call failed (response not shown)." >&2
      exit 2
    fi

    local count
    count="$(json_get "$accounts_json" "Array.isArray(data.result) ? String(data.result.length) : '0'")"

    if [[ "$count" == "1" ]]; then
      account_id="$(json_get "$accounts_json" "data.result[0] && data.result[0].id")"
    else
      echo "Multiple Cloudflare accounts detected. Set CLOUDFLARE_ACCOUNT_ID then re-run." >&2
      echo "Candidates:" >&2
      node - <<'NODE' <<<"$accounts_json" >&2
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
const list = Array.isArray(data.result) ? data.result : [];
list.forEach((a, i) => {
  const name = a && a.name ? a.name : '(no name)';
  const id = a && a.id ? a.id : '(no id)';
  process.stderr.write(`${i+1}) ${name}  ${id}\n`);
});
NODE
      exit 2
    fi
  fi

  if [[ -z "${account_id:-}" ]]; then
    echo "ERROR: could not determine CLOUDFLARE_ACCOUNT_ID." >&2
    exit 2
  fi

  echo "CLOUDFLARE_ACCOUNT_ID=${account_id}"

  local orgs_json
  orgs_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/organizations")"

  local team_domain
  team_domain="$(json_get "$orgs_json" "(data.result && data.result[0] && data.result[0].auth_domain) || ''")" || true
  if [[ -z "$team_domain" ]]; then
    echo "ERROR: could not determine CF_ACCESS_TEAM_DOMAIN from Access organizations." >&2
    echo "Hint: verify Access is enabled for this account, or set CF_ACCESS_TEAM_DOMAIN manually." >&2
    exit 2
  fi

  echo "CF_ACCESS_TEAM_DOMAIN=${team_domain}"

  local apps_json
  apps_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps")"

  local match_count
  match_count="$(node - <<'NODE' <<<"$apps_json"
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
const apps = Array.isArray(data.result) ? data.result : [];
const host = String(process.env.APERION_ACCESS_APP_HOST || '').toLowerCase();
const matches = apps.filter(a => {
  if (!a) return false;
  if (a.domain && String(a.domain).toLowerCase() === host) return true;
  const shd = a.self_hosted_domains;
  if (Array.isArray(shd) && shd.map(String).map(s=>s.toLowerCase()).includes(host)) return true;
  const shd2 = a.self_hosted_domains && a.self_hosted_domains.domains;
  if (Array.isArray(shd2) && shd2.map(String).map(s=>s.toLowerCase()).includes(host)) return true;
  return false;
});
process.stdout.write(String(matches.length));
NODE
)"

  if [[ "$match_count" != "1" ]]; then
    echo "ERROR: could not uniquely identify the Access application for ${resolved_host} (matches=${match_count})." >&2
    echo "Candidates:" >&2
    node - <<'NODE' <<<"$apps_json" >&2
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
const apps = Array.isArray(data.result) ? data.result : [];
apps.forEach((a, i) => {
  const name = a && a.name ? a.name : '(no name)';
  const id = a && a.id ? a.id : '(no id)';
  const domain = a && a.domain ? a.domain : '';
  const aud = Array.isArray(a && a.aud) && a.aud.length ? a.aud[0] : '';
  process.stderr.write(`${i+1}) ${name}  id=${id}  domain=${domain}  aud=${aud}\n`);
});
NODE
  echo "Hint: ensure there is exactly one Access App matching ${resolved_host}, or set CF_ACCESS_AUD manually." >&2
    exit 2
  fi

  local aud
  aud="$(node - <<'NODE' <<<"$apps_json"
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
const apps = Array.isArray(data.result) ? data.result : [];
const host = String(process.env.APERION_ACCESS_APP_HOST || '').toLowerCase();
const match = apps.find(a => {
  if (!a) return false;
  if (a.domain && String(a.domain).toLowerCase() === host) return true;
  const shd = a.self_hosted_domains;
  if (Array.isArray(shd) && shd.map(String).map(s=>s.toLowerCase()).includes(host)) return true;
  const shd2 = a.self_hosted_domains && a.self_hosted_domains.domains;
  if (Array.isArray(shd2) && shd2.map(String).map(s=>s.toLowerCase()).includes(host)) return true;
  return false;
});
const aud = match && Array.isArray(match.aud) && match.aud.length ? match.aud[0] : '';
process.stdout.write(String(aud));
NODE
)"

  if [[ -z "$aud" ]]; then
    echo "ERROR: could not extract CF_ACCESS_AUD from the matched Access app." >&2
    exit 2
  fi

  echo "CF_ACCESS_AUD=${aud}"

  cat <<EOF

Add these to .dev.vars (safe; no secrets):

CLOUDFLARE_ACCOUNT_ID=${account_id}
APERION_AUTH_MODE=access
CF_ACCESS_TEAM_DOMAIN=${team_domain}
CF_ACCESS_AUD=${aud}
EOF

  echo
  echo "Service token file (never printed):"
  echo "  ${APERION_SECRETS_FILE:-$HOME/.config/aperion/cf_access.env}"
  echo "Reminder: keep CF_ACCESS_SERVICE_TOKEN_ID/SECRET in that file (or export them), never in .dev.vars."
}

main "$@"
