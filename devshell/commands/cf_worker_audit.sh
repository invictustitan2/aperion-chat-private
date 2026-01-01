#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:worker:audit
#
# Goal: produce receipt-friendly evidence that api.aperion.cc is (or is not)
# bound to the intended Cloudflare Worker script.
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Use curl -K - so headers come from stdin config.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
# shellcheck source=devshell/lib/surfaces.sh
source "${repo_root}/devshell/lib/surfaces.sh"

surface='api'
base_url_override=''
ZONE_NAME='aperion.cc'

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
    --zone)
      ZONE_NAME="${2:-}"
      shift 2
      ;;
    *)
      devshell_die "unknown arg: $1"
      ;;
  esac
done

BASE_URL="$(devshell_api_base_url_resolve "$surface" "$base_url_override")"

HOSTNAME=""
mapfile -t _url_parts < <(devshell_split_url_host_and_path_prefix "$BASE_URL")
HOSTNAME="${_url_parts[0]:-}"
[[ -n "$HOSTNAME" ]] || devshell_die "failed to parse host from base url: $BASE_URL"

need_env() {
  local k="$1"
  if [[ -z "${!k-}" ]]; then
    printf 'ERROR: %s is required in the environment (not printed).\n' "$k" >&2
    return 1
  fi
}

redact_id() {
  local s="${1:-}"
  if [[ ${#s} -le 10 ]]; then
    printf '%s' "$s"
    return 0
  fi
  printf '%s…%s' "${s:0:6}" "${s: -4}"
}

strip_to_host() {
  local s="${1:-}"
  s="${s%$'\r'}"
  s="${s#http://}"
  s="${s#https://}"
  s="${s%%/*}"
  s="${s%%\?*}"
  s="${s%%#*}"
  printf '%s' "$s"
}

cf_api_get() {
  local url="$1"

  local tmp_body tmp_hdr
  tmp_body="$(mktemp)"
  tmp_hdr="$(mktemp)"

  local status
  status="$(
    cat <<EOF | curl -sS -D "$tmp_hdr" -o "$tmp_body" -w '%{http_code}' -K -
url = "${url}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
EOF
  )"

  printf '%s\n' "$status"
  printf '%s\n' "$tmp_hdr"
  printf '%s\n' "$tmp_body"
}

read_intended_worker_name() {
  local wrangler_toml="${repo_root}/apps/api-worker/wrangler.toml"
  if [[ ! -f "$wrangler_toml" ]]; then
    printf ''
    return 0
  fi

  # Keep it intentionally simple: first name = "..." wins.
  grep -E '^[[:space:]]*name[[:space:]]*=' "$wrangler_toml" | head -n 1 | sed -E 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*$/\1/' || true
}

wrangler_run() {
  if command -v wrangler >/dev/null 2>&1; then
    wrangler "$@"
    return $?
  fi
  if command -v pnpm >/dev/null 2>&1; then
    pnpm -s exec wrangler "$@"
    return $?
  fi
  return 127
}

main() {
  if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
    printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
    exit 3
  fi

  local missing=0
  need_env CLOUDFLARE_API_TOKEN || missing=1
  need_env CLOUDFLARE_ACCOUNT_ID || missing=1
  if [[ "$missing" -ne 0 ]]; then
    exit 2
  fi

  local intended_worker
  intended_worker="$(read_intended_worker_name)"
  printf 'HOSTNAME: %s\n' "$HOSTNAME"
  printf 'ZONE_NAME: %s\n' "$ZONE_NAME"
  printf 'WORKER.INTENDED_NAME: %s\n' "${intended_worker:-unknown}"

  # 1) Zone lookup
  local zone_status zone_hdr zone_body
  mapfile -t zone_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}")
  zone_status="${zone_resp[0]}"; zone_hdr="${zone_resp[1]}"; zone_body="${zone_resp[2]}"
  printf 'ZONE.HTTP_STATUS: %s\n' "$zone_status"

  local zone_id
  zone_id="$(node -e "const fs=require('fs'); try{const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const z=(Array.isArray(d&&d.result)&&d.result[0])?d.result[0]:null; process.stdout.write(String((z&&z.id)||''));}catch(e){}" "$zone_body" 2>/dev/null || true)"
  if [[ -z "$zone_id" ]]; then
    printf 'ZONE.FOUND: no\n'
    printf 'ORIGIN.OK: no\n'
    printf 'ORIGIN.MISMATCH: yes\n'
    printf 'ORIGIN.REASON: unable_to_find_zone_id\n'
    exit 2
  fi
  printf 'ZONE.FOUND: yes\n'
  printf 'ZONE.ID: %s\n' "$(redact_id "$zone_id")"

  # 2) DNS record evidence (api.aperion.cc)
  local dns_status dns_hdr dns_body
  mapfile -t dns_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?name=${HOSTNAME}")
  dns_status="${dns_resp[0]}"; dns_hdr="${dns_resp[1]}"; dns_body="${dns_resp[2]}"
  printf 'DNS.HTTP_STATUS: %s\n' "$dns_status"

  node -e "const fs=require('fs');
try{
  const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  const recs=Array.isArray(d&&d.result)?d.result:[];
  const out=[];
  out.push(['DNS.RECORDS.COUNT',String(recs.length)]);
  for(let i=0;i<Math.min(3,recs.length);i++){
    const r=recs[i]||{};
    const name=String(r.name||'');
    const type=String(r.type||'');
    const proxied=(r.proxied===true)?'yes':(r.proxied===false)?'no':'unknown';
    const content=String(r.content||'');
    const contentHost=content.replace(/^https?:\/\//i,'').split('/')[0].split('?')[0].split('#')[0];
    out.push(['DNS.RECORD.'+i+'.NAME',name]);
    out.push(['DNS.RECORD.'+i+'.TYPE',type]);
    out.push(['DNS.RECORD.'+i+'.PROXIED',proxied]);
    out.push(['DNS.RECORD.'+i+'.CONTENT_HOST',contentHost]);
  }
  process.stdout.write(out.map(([k,v])=>k+': '+v).join('\\n')+'\\n');
}catch(e){}" "$dns_body" 2>/dev/null || true

  # 3) Worker route bindings (zone-level)
  local routes_status routes_hdr routes_body
  mapfile -t routes_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/zones/${zone_id}/workers/routes")
  routes_status="${routes_resp[0]}"; routes_hdr="${routes_resp[1]}"; routes_body="${routes_resp[2]}"
  printf 'WORKER_ROUTES.HTTP_STATUS: %s\n' "$routes_status"

  local routes_matches_json
  routes_matches_json="$(node -e "const fs=require('fs');
try{
  const host=String(process.argv[2]).toLowerCase();
  const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  const rows=Array.isArray(d&&d.result)?d.result:[];
  const matches=[];
  for(const r of rows){
    const pattern=String(r&&r.pattern||'');
    const script=String((r&&r.script)||'');
    if(pattern.toLowerCase().includes(host)) matches.push({pattern,script});
  }
  process.stdout.write(JSON.stringify(matches));
}catch(e){process.stdout.write('[]');}" "$routes_body" "$HOSTNAME" 2>/dev/null || true)"

  node -e "try{const m=JSON.parse(process.argv[1]); const out=[]; out.push(['WORKER_ROUTES.MATCH_COUNT',String(m.length)]); for(let i=0;i<Math.min(5,m.length);i++){ const row=m[i]||{}; out.push(['WORKER_ROUTES.MATCH.'+i+'.PATTERN',String(row.pattern||'')]); out.push(['WORKER_ROUTES.MATCH.'+i+'.SCRIPT',String(row.script||'')]); } process.stdout.write(out.map(([k,v])=>k+': '+v).join('\\n')+'\\n');}catch(e){}" "$routes_matches_json" 2>/dev/null || true

  # 4) Worker custom domains (account-level)
  local domains_status domains_hdr domains_body
  mapfile -t domains_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains")
  domains_status="${domains_resp[0]}"; domains_hdr="${domains_resp[1]}"; domains_body="${domains_resp[2]}"
  printf 'WORKER_DOMAINS.HTTP_STATUS: %s\n' "$domains_status"

  local domains_matches_json
  domains_matches_json="$(node -e "const fs=require('fs');
try{
  const host=String(process.argv[2]).toLowerCase();
  const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  const rows=Array.isArray(d&&d.result)?d.result:[];
  const matches=[];
  for(const r of rows){
    const hostname=String((r&&r.hostname)||'');
    const service=String((r&&r.service)||r.script||r.name||'');
    const environment=String((r&&r.environment)||'');
    if(hostname.toLowerCase()===host) matches.push({hostname,service,environment});
  }
  process.stdout.write(JSON.stringify(matches));
}catch(e){process.stdout.write('[]');}" "$domains_body" "$HOSTNAME" 2>/dev/null || true)"

  node -e "try{const m=JSON.parse(process.argv[1]); const out=[]; out.push(['WORKER_DOMAINS.MATCH_COUNT',String(m.length)]); for(let i=0;i<Math.min(5,m.length);i++){ const row=m[i]||{}; out.push(['WORKER_DOMAINS.MATCH.'+i+'.HOSTNAME',String(row.hostname||'')]); out.push(['WORKER_DOMAINS.MATCH.'+i+'.SERVICE',String(row.service||'')]); out.push(['WORKER_DOMAINS.MATCH.'+i+'.ENVIRONMENT',String(row.environment||'')]); } process.stdout.write(out.map(([k,v])=>k+': '+v).join('\\n')+'\\n');}catch(e){}" "$domains_matches_json" 2>/dev/null || true

  # 5) Optional: Wrangler deployment evidence (best-effort)
  if [[ -n "$intended_worker" ]]; then
    if deployments_json="$(wrangler_run deployments list --name "$intended_worker" --json 2>/dev/null || true)" && [[ -n "$deployments_json" ]]; then
      node -e "try{const d=JSON.parse(process.argv[1]); const rows=Array.isArray(d)?d:[]; const latest=rows[0]||{}; const out=[]; out.push(['WRANGLER.DEPLOYMENTS.COUNT',String(rows.length)]); out.push(['WRANGLER.DEPLOYMENTS.LATEST.ID',String(latest.id||'')]); out.push(['WRANGLER.DEPLOYMENTS.LATEST.CREATED_ON',String(latest.created_on||'')]); process.stdout.write(out.map(([k,v])=>k+': '+v).join('\\n')+'\\n');}catch(e){}" "$deployments_json" 2>/dev/null || true
    else
      printf 'WRANGLER.DEPLOYMENTS.COUNT: unknown\n'
    fi
  else
    printf 'WRANGLER.DEPLOYMENTS.COUNT: unknown\n'
  fi

  # 6) Conclusion
  local scripts
  scripts="$(node -e "try{const a=JSON.parse(process.argv[1]); const b=JSON.parse(process.argv[2]); const s=new Set(); for(const r of a){ if(r&&r.script) s.add(String(r.script)); } for(const r of b){ if(r&&r.service) s.add(String(r.service)); } process.stdout.write(Array.from(s).filter(Boolean).join(','));}catch(e){}" "$routes_matches_json" "$domains_matches_json" 2>/dev/null || true)"

  if [[ -n "$intended_worker" && ",${scripts}," == *",${intended_worker},"* ]]; then
    printf 'ORIGIN.OK: yes\n'
    printf 'ORIGIN.MISMATCH: no\n'
    printf 'ORIGIN.SERVED_BY: %s\n' "$intended_worker"
    exit 0
  fi

  if [[ -n "$scripts" ]]; then
    printf 'ORIGIN.OK: no\n'
    printf 'ORIGIN.MISMATCH: yes\n'
    printf 'ORIGIN.REASON: hostname_bound_to_different_worker\n'
    printf 'ORIGIN.SERVED_BY: %s\n' "$scripts"
    exit 0
  fi

  printf 'ORIGIN.OK: no\n'
  printf 'ORIGIN.MISMATCH: yes\n'
  printf 'ORIGIN.REASON: no_worker_route_or_custom_domain_binding_found\n'
  exit 0
}

main "$@"
