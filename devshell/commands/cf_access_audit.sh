#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# Evidence-based Cloudflare Access audit for:
# - api.aperion.cc
# - chat.aperion.cc
#
# Hard rules:
# - Never print secrets.
# - Never put secrets into argv.
# - Use curl -K - so headers come from stdin config.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"
# shellcheck source=devshell/lib/surfaces.sh
source "${repo_root}/devshell/lib/surfaces.sh"

HOST_API="api.aperion.cc"
HOST_CHAT="chat.aperion.cc"

# Optional overrides to prepare for Path B (same-origin /api mount).
# Defaults remain the current production hostnames.
api_surface='api'
api_base_url_override=''
api_host_override=''
chat_host_override=''
api_path_prefix='' # e.g. "/api" for browser surface

want_json='no'
while [[ "$#" -gt 0 ]]; do
  case "${1:-}" in
    --json)
      want_json='yes'
      shift
      ;;
    --surface|--api-surface)
      api_surface="${2:-}"
      shift 2
      ;;
    --base-url|--api-base-url)
      api_base_url_override="${2:-}"
      shift 2
      ;;
    --api-host)
      api_host_override="${2:-}"
      shift 2
      ;;
    --chat-host)
      chat_host_override="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'HELP'
Usage:
  ./dev cf:access:audit [--json]
  ./dev cf:access:audit [--surface api|browser] [--base-url https://...]
  ./dev cf:access:audit [--api-host host] [--chat-host host]

Defaults (no args):
  - API host:  api.aperion.cc
  - Chat host: chat.aperion.cc

Notes:
  - --surface/--base-url only affects the API host and optional path prefix.
  - When using browser surface (https://chat.aperion.cc/api), the audit will
    look for Access app paths that could match /api/v1/*.
HELP
      exit 0
      ;;
    *)
      printf 'ERROR: unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

# Only consult the surface resolver when explicitly requested.
if [[ -n "$api_base_url_override" || "$api_surface" != 'api' ]]; then
  base_url="$(devshell_api_base_url_resolve "$api_surface" "$api_base_url_override")"
  mapfile -t host_and_path < <(devshell_split_url_host_and_path_prefix "$base_url")
  HOST_API="${host_and_path[0]}"
  api_path_prefix="${host_and_path[1]}"
  api_path_prefix="${api_path_prefix%/}"
  if [[ -z "$api_path_prefix" || "$api_path_prefix" == '/' ]]; then
    api_path_prefix=''
  fi
fi

if [[ -n "$api_host_override" ]]; then
  HOST_API="$api_host_override"
  api_path_prefix=''
fi

if [[ -n "$chat_host_override" ]]; then
  HOST_CHAT="$chat_host_override"
fi

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

json_hint() {
  # Print shape hints without dumping response.
  local body_file="$1"
  node -e "try { const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const keys=(data&&typeof data==='object')?Object.keys(data).slice(0,10):[]; const success=(data&&typeof data==='object'&&'success' in data)?String(data.success):'unknown'; const errCount=(data&&Array.isArray(data.errors))?data.errors.length:0; const errCodes=(data&&Array.isArray(data.errors))?Array.from(new Set(data.errors.map(e=>(e&&e.code)?String(e.code):'unknown'))).slice(0,5):[]; const errMsgs=(data&&Array.isArray(data.errors))?Array.from(new Set(data.errors.map(e=>(e&&e.message)?String(e.message):'unknown'))).slice(0,3):[]; process.stdout.write('response.success: '+success+'\\n'); process.stdout.write('response.keys: '+(keys.join(',')||'(none)')+'\\n'); process.stdout.write('response.errors.count: '+errCount+'\\n'); process.stdout.write('response.errors.codes: '+(errCodes.join(',')||'(none)')+'\\n'); process.stdout.write('response.errors.messages: '+(errMsgs.join(' | ')||'(none)')+'\\n'); } catch { process.stdout.write('response.parseable_json: no\\n'); }" "$body_file" 2>/dev/null || true
}

file_bytes() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -c <"$file" | tr -d ' '
    return 0
  fi
  printf '0'
}

parse_org_auth_domain() {
  local body_file="$1"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const r=(data&&data.result)!=null?data.result:null; let obj=null; if(Array.isArray(r)) obj=r[0]||null; else if(r&&typeof r==='object') obj=r; const auth=obj&&(obj.auth_domain||obj.team_domain||obj.domain)||''; process.stdout.write(String(auth));" "$body_file" 2>/dev/null || true
}

extract_var_from_env_file() {
  # Extract KEY's value from a shell-like export file without executing it.
  # Supports: KEY=val, export KEY=val, quoted or unquoted.
  local file="$1"
  local key="$2"
  node -e "const fs=require('fs'); const path=process.argv[1]; const key=process.argv[2]; const text=fs.existsSync(path)?fs.readFileSync(path,'utf8'):''; const lines=text.split(/\r?\n/);
let found='';
for(const raw of lines){
  const line=raw.trim();
  if(!line||line.startsWith('#')) continue;
  const l=line.startsWith('export ')?line.slice(7).trim():line;
  if(!l.startsWith(key+'=')) continue;
  let v=l.slice(key.length+1).trim();
  if((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))){ v=v.slice(1,-1); }
  found=v; break;
}
process.stdout.write(found);" "$file" "$key" 2>/dev/null || true
}

apps_inventory_summary() {
  # Print a small inventory so hostname mismatches are obvious.
  local body_file="$1"

  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const apps=Array.isArray(data&&data.result)?data.result:[];
function extractDomains(app){ const domains=[]; if(app&&app.domain) domains.push(String(app.domain)); const shd=app&&app.self_hosted_domains; if(Array.isArray(shd)){ for(const d of shd){ if(typeof d==='string') domains.push(d); else if(d&&typeof d==='object'){ if(d.domain) domains.push(String(d.domain)); if(d.hostname) domains.push(String(d.hostname)); } } } return Array.from(new Set(domains.filter(Boolean))); }
const flat=[];
for(const a of apps){ const name=a&&a.name?String(a.name):''; const id=a&&a.id?String(a.id):''; const domains=extractDomains(a); for(const d of domains){ flat.push({id,name,domain:String(d)}); } if(domains.length===0){ flat.push({id,name,domain:''}); } }
const suffix='aperion.cc';
const aperion=flat.filter(x=>x.domain.toLowerCase().includes(suffix));
const out=[];
out.push(['APPS.COUNT',String(apps.length)]);
out.push(['APPS.DOMAIN_ROWS',String(flat.length)]);
out.push(['APPS.DOMAIN_MATCHES_APERION_CC',String(aperion.length)]);
for(let i=0;i<Math.min(15,aperion.length);i++){ const x=aperion[i]; out.push(['APPS.APERION.'+i+'.NAME',x.name||'']); out.push(['APPS.APERION.'+i+'.DOMAIN',x.domain||'']); }
process.stdout.write(out.map(([k,v])=>k+': '+v).join('\n')+'\n');" "$body_file" 2>/dev/null || true
}

service_token_match_summary() {
  # Safely checks whether the configured CF_ACCESS_SERVICE_TOKEN_ID corresponds
  # to a real Cloudflare service token, without printing the ID.
  local body_file="$1"
  local configured_id="$2"

  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const configured=String(process.argv[2]||''); const list=Array.isArray(data&&data.result)?data.result:[];
function redact(s){
  const v=String(s||'');
  if(v.length<=10) return v;
  return v.slice(0,6)+'…'+v.slice(-4);
}
const toks=list.map(t=>({
  name:String((t&&t.name)||''),
  id:String((t&&t.id)||''),
  clientId:String((t&&((t.client_id)||(t.clientId)||(t.credentials&&t.credentials.client_id)))||'')
})).filter(t=>t.id||t.clientId||t.name);

const hasClientId=toks.some(t=>Boolean(t.clientId));
const hasId=toks.some(t=>Boolean(t.id));
let hit=null;
if(configured && hasClientId){
  hit=toks.find(t=>t.clientId && t.clientId===configured) || null;
}

const out=[];
out.push(['COUNT',String(list.length)]);
out.push(['TOKEN_LIST.HAS_CLIENT_ID',hasClientId? 'yes':'no']);
out.push(['TOKEN_LIST.HAS_ID',hasId? 'yes':'no']);
out.push(['CONFIGURED_CLIENT_ID_PRESENT',configured? 'yes':'no']);
out.push(['CONFIGURED_CLIENT_ID_REDACTED',configured? redact(configured):'']);
out.push(['CONFIGURED_CLIENT_ID_MATCHES_TOKEN',(!configured||!hasClientId)? 'unknown' : (hit? 'yes':'no')]);
if(hit){ out.push(['CONFIGURED_CLIENT_ID_MATCH_NAME',hit.name]); }

// Print up to a few candidates to help the operator update CF_ACCESS_SERVICE_TOKEN_ID
// without dumping full identifiers.
for(let i=0;i<Math.min(5,toks.length);i++){
  const t=toks[i];
  out.push(['TOKEN.'+i+'.NAME',t.name||'']);
  out.push(['TOKEN.'+i+'.CLIENT_ID_REDACTED',t.clientId? redact(t.clientId):'']);
  out.push(['TOKEN.'+i+'.ID_REDACTED',t.id? redact(t.id):'']);
}
process.stdout.write(out.map(([k,v])=>k+': '+v).join('\\n')+'\\n');" "$body_file" "$configured_id" 2>/dev/null || true
}

apps_matches_tsv() {
  local hostname="$1"
  local body_file="$2"

  node -e "const fs=require('fs'); const host=String(process.argv[1]); const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); const apps=Array.isArray(data&&data.result)?data.result:[];

function stripToHost(s){
  let v=String(s||'').trim();
  v=v.replace(/^https?:\/\//i,'');
  v=v.split('/')[0];
  v=v.split('#')[0];
  v=v.split('?')[0];
  return v;
}

function normalizeHost(s){return stripToHost(s).toLowerCase();}

function extractDomains(app){ const domains=[]; if(app&&app.domain) domains.push(String(app.domain)); const shd=app&&app.self_hosted_domains; if(Array.isArray(shd)){ for(const d of shd){ if(typeof d==='string') domains.push(d); else if(d&&typeof d==='object'){ if(d.domain) domains.push(String(d.domain)); if(d.hostname) domains.push(String(d.hostname)); } } } else if(shd&&typeof shd==='object'&&Array.isArray(shd.domains)){ for(const d of shd.domains){ domains.push(String(d)); } } return Array.from(new Set(domains.filter(Boolean))); }

function extractPaths(app){ const paths=[]; const shd=app&&app.self_hosted_domains; if(Array.isArray(shd)){ for(const d of shd){ if(d&&typeof d==='object'){ if(d.path) paths.push(String(d.path)); if(Array.isArray(d.paths)) paths.push(...d.paths.map(String)); } } } if(app&&Array.isArray(app.paths)) paths.push(...app.paths.map(String)); if(app&&typeof app.path==='string') paths.push(String(app.path)); return Array.from(new Set(paths.filter(Boolean))); }

function audFirst(app){
  const v=app&&app.aud;
  if(typeof v==='string' && v.trim()) return v.trim();
  if(Array.isArray(v) && v.length) return String(v[0]);
  return '';
}

function appType(app){ return String((app&&((app.type)||(app.app_type)||(app.appType)||(app.application_type)))||''); }
function sessionDuration(app){ return String((app&&((app.session_duration)||(app.sessionDuration)))||''); }
function shdCount(app){ const shd=app&&app.self_hosted_domains; if(Array.isArray(shd)) return String(shd.length); if(shd&&typeof shd==='object'&&Array.isArray(shd.domains)) return String(shd.domains.length); return '0'; }

function matches(app){ const domains=extractDomains(app).map(normalizeHost); return domains.includes(normalizeHost(host)); }

const matchesList=apps.filter(matches);
for(const app of matchesList){
  const id=app&&app.id?String(app.id):'';
  const name=app&&app.name?String(app.name):'';
  const domains=extractDomains(app).join(',')||'-';
  const paths=extractPaths(app).join(',')||'-';
  const aud=audFirst(app)||'-';
  const typ=appType(app)||'-';
  const sess=sessionDuration(app)||'-';
  const shdc=shdCount(app)||'0';
  process.stdout.write([id,name,domains,paths,aud,typ,sess,shdc].join('\t')+'\n');
}
" "$hostname" "$body_file" 2>/dev/null || true
}

app_detail_hint() {
  # Print selected Access app fields for diagnosis (safe; no secrets).
  local body_file="$1"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const app=(data&&data.result)||{};
function yesno(v){return v? 'yes':'no';}
function str(v){return (v==null)?'':String(v);}
function listLen(v){
  if(Array.isArray(v)) return String(v.length);
  if(typeof v==='string' && v.trim()) return '1';
  return '0';
}
// Self-hosted domains: keep raw strings/hostnames (may include paths like api.aperion.cc/*)
let shd=[];
const raw=app&&app.self_hosted_domains;
if(Array.isArray(raw)){
  for(const d of raw){
    if(typeof d==='string') shd.push(d);
    else if(d&&typeof d==='object') shd.push(str(d.domain||d.hostname||''));
  }
}
shd=Array.from(new Set(shd.filter(Boolean)));

const out=[];
out.push(['APP_TYPE',str(app.app_type||app.type||'')]);
out.push(['DOMAIN',str(app.domain||'')]);
out.push(['SELF_HOSTED_DOMAINS.COUNT',String(shd.length)]);
for(let i=0;i<Math.min(8,shd.length);i++){ out.push(['SELF_HOSTED_DOMAINS.'+i,shd[i]]); }
out.push(['AUD.COUNT',listLen(app.aud)]);
if(typeof app.aud==='string' && app.aud.trim()){
  out.push(['AUD.0',app.aud.trim()]);
}else if(Array.isArray(app.aud)){
  for(let i=0;i<Math.min(4,app.aud.length);i++){ out.push(['AUD.'+i,str(app.aud[i])]); }
}
out.push(['ALLOWED_IDPS.COUNT',listLen(app.allowed_idps)]);
out.push(['SESSION_DURATION',str(app.session_duration||'')]);
out.push(['AUTO_REDIRECT_TO_IDENTITY',yesno(app.auto_redirect_to_identity)]);
out.push(['APP_LAUNCHER_VISIBLE',yesno(app.app_launcher_visible)]);
out.push(['HTTP_ONLY_COOKIE_ATTRIBUTE',str(app.http_only_cookie_attribute||'')]);
out.push(['SAME_SITE_COOKIE_ATTRIBUTE',str(app.same_site_cookie_attribute||'')]);
process.stdout.write(out.map(([k,v])=>k+': '+v).join('\n')+'\n');" "$body_file" 2>/dev/null || true
}

policy_rows_tsv() {
  local body_file="$1"

  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const list=Array.isArray(data&&data.result)?data.result:[];
function upper(s){ return String(s||'').toUpperCase(); }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function scan(obj){
  const seen=new Set();
  let hasRef=false;
  let hasIdValue=false;

  function walk(v){
    if(!v||typeof v!=='object') return;
    if(seen.has(v)) return;
    seen.add(v);

    if(Object.prototype.hasOwnProperty.call(v,'service_token') || Object.prototype.hasOwnProperty.call(v,'serviceToken')){
      hasRef=true;
      const st=v.service_token || v.serviceToken;
      if(st && typeof st==='object'){
        const id=String(st.id||'');
        if(uuid.test(id)) hasIdValue=true;
      }
    }

    for(const k of Object.keys(v)) walk(v[k]);
  }
  walk(obj);
  return {hasRef,hasIdValue};
}

for(const p of list){
  const id=p&&p.id?String(p.id):'';
  const name=p&&p.name?String(p.name):'';
  const decision=upper(p&&(p.decision||p.action||p.effect||''));
  const s=scan(p);
  process.stdout.write([id,name,decision||'UNKNOWN',s.hasRef?'yes':'no',s.hasIdValue?'yes':'no'].join('\t')+'\n');
}
" "$body_file" 2>/dev/null || true
}

print_kv() {
  local k="$1"; shift
  printf '%s: %s\n' "$k" "$*"
}

main_text() {
  local missing=0
  need_env CLOUDFLARE_API_TOKEN || missing=1
  need_env CLOUDFLARE_ACCOUNT_ID || missing=1
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi

  print_kv 'CF_ACCESS_AUDIT_VERSION' '1'
  print_kv 'CLOUDFLARE_ACCOUNT_ID' "$(redact_id "$CLOUDFLARE_ACCOUNT_ID")"

  # Org/team domain
  local org_status org_hdr org_body
  mapfile -t org_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/organizations")
  org_status="${org_resp[0]}"; org_hdr="${org_resp[1]}"; org_body="${org_resp[2]}"

  if [[ "$org_status" != "200" ]]; then
    print_kv 'ORG.HTTP_STATUS' "$org_status"
    print_kv 'ORG.BODY_BYTES' "$(file_bytes "$org_body")"
    json_hint "$org_body" | sed 's/^/ORG./'
    local org_err_codes
    org_err_codes="$(node -e "try{const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const codes=(d&&Array.isArray(d.errors))?Array.from(new Set(d.errors.map(e=>String((e&&e.code)!=null?e.code:'unknown')))).join(','):'';process.stdout.write(codes);}catch(e){}" "$org_body" 2>/dev/null || true)"
    if [[ "$org_status" == "403" && "$org_err_codes" == *"10000"* ]]; then
      print_kv 'CONCLUSION' 'CLOUDFLARE_API_TOKEN_AUTHENTICATION_ERROR'
      print_kv 'HINT' 'Cloudflare returned error 10000 (Authentication error). CLOUDFLARE_API_TOKEN is invalid for the Cloudflare API (or not the token you think is being used). Run ./dev secrets:wizard (or ./dev secrets:set CLOUDFLARE_API_TOKEN), then verify with the /user/tokens/verify endpoint.'
    else
      print_kv 'CONCLUSION' 'INSUFFICIENT_PERMISSIONS_OR_ENDPOINT'
      print_kv 'HINT' 'Ensure CLOUDFLARE_API_TOKEN has Zero Trust / Access read permissions.'
    fi
    exit 2
  fi

  local team_domain
  team_domain="$(parse_org_auth_domain "$org_body")"
  print_kv 'ACCESS_ORG.TEAM_DOMAIN' "${team_domain:-unknown}"

  # Apps list
  local apps_status apps_hdr apps_body
  mapfile -t apps_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/apps")
  apps_status="${apps_resp[0]}"; apps_hdr="${apps_resp[1]}"; apps_body="${apps_resp[2]}"

  if [[ "$apps_status" != "200" ]]; then
    print_kv 'APPS.HTTP_STATUS' "$apps_status"
    print_kv 'APPS.BODY_BYTES' "$(file_bytes "$apps_body")"
    json_hint "$apps_body" | sed 's/^/APPS./'
    local apps_err_codes
    apps_err_codes="$(node -e "try{const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const codes=(d&&Array.isArray(d.errors))?Array.from(new Set(d.errors.map(e=>String((e&&e.code)!=null?e.code:'unknown')))).join(','):'';process.stdout.write(codes);}catch(e){}" "$apps_body" 2>/dev/null || true)"
    if [[ "$apps_status" == "403" && "$apps_err_codes" == *"10000"* ]]; then
      print_kv 'CONCLUSION' 'CLOUDFLARE_API_TOKEN_AUTHENTICATION_ERROR'
      print_kv 'HINT' 'Cloudflare returned error 10000 (Authentication error). CLOUDFLARE_API_TOKEN is invalid for the Cloudflare API (or not the token you think is being used). Run ./dev secrets:wizard (or ./dev secrets:set CLOUDFLARE_API_TOKEN), then verify with the /user/tokens/verify endpoint.'
    else
      print_kv 'CONCLUSION' 'INSUFFICIENT_PERMISSIONS_OR_ENDPOINT'
      print_kv 'HINT' 'Ensure CLOUDFLARE_API_TOKEN can list Access applications.'
    fi
    exit 2
  fi

  # High-signal inventory to diagnose hostname mismatches quickly.
  apps_inventory_summary "$apps_body" | sed 's/^/INV./'

  # Service token inventory + safe match check.
  local st_status st_hdr st_body
  mapfile -t st_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/service_tokens")
  st_status="${st_resp[0]}"; st_hdr="${st_resp[1]}"; st_body="${st_resp[2]}"
  print_kv 'SERVICE_TOKENS.HTTP_STATUS' "$st_status"
  if [[ "$st_status" != "200" ]]; then
    print_kv 'SERVICE_TOKENS.BODY_BYTES' "$(file_bytes "$st_body")"
    json_hint "$st_body" | sed 's/^/SERVICE_TOKENS./'
  else
    # Try to extract a configured service token ID from env or secrets file.
    local configured_id='' id_source='none'
    if [[ -n "${CF_ACCESS_SERVICE_TOKEN_ID-}" ]]; then
      configured_id="${CF_ACCESS_SERVICE_TOKEN_ID}"
      id_source='env'
    else
      local secrets_file
      secrets_file="${APERION_SECRETS_FILE:-${HOME}/.config/aperion/cf_access.env}"
      if [[ -f "$secrets_file" ]]; then
        configured_id="$(extract_var_from_env_file "$secrets_file" 'CF_ACCESS_SERVICE_TOKEN_ID')"
        if [[ -n "$configured_id" ]]; then
          id_source='secrets-file'
        fi
      fi
    fi
    print_kv 'SERVICE_TOKENS.CONFIGURED_ID_SOURCE' "$id_source"
    service_token_match_summary "$st_body" "$configured_id" | sed 's/^/SERVICE_TOKENS./'
  fi

  audit_host() {
    local hostname="$1"
    local label="$2"
    local v1_prefix="${3:-}"

    print_kv "HOST.${label}" "$hostname"

    local matches
    matches="$(apps_matches_tsv "$hostname" "$apps_body" || true)"

    local count
    count="$(printf '%s' "$matches" | grep -c '.' || true)"
    print_kv "APP_MATCH_COUNT.${label}" "$count"

    if [[ "$count" -eq 0 ]]; then
      print_kv "APP_MATCH.${label}" 'none'
      return 0
    fi

    local i=0
    local any_service_token_ref='no'
    local any_service_token_ids='no'
    local any_service_auth_decision='no'
    local any_paths_cover_v1='unknown'

    while IFS=$'\t' read -r app_id app_name app_domains app_paths app_aud app_type app_session app_shd_count; do
      [[ -n "$app_id" ]] || continue

      print_kv "APP.${label}.${i}.ID" "$(redact_id "$app_id")"
      print_kv "APP.${label}.${i}.NAME" "${app_name:-unknown}"
      print_kv "APP.${label}.${i}.DOMAINS" "${app_domains:-}"
      print_kv "APP.${label}.${i}.PATHS" "${app_paths:-}"
      print_kv "APP.${label}.${i}.AUD" "${app_aud:-}"
      print_kv "APP.${label}.${i}.TYPE" "${app_type:-}"
      print_kv "APP.${label}.${i}.SESSION_DURATION" "${app_session:-}"
      print_kv "APP.${label}.${i}.SELF_HOSTED_DOMAIN_COUNT" "${app_shd_count:-0}"

      # App detail (best-effort) to diagnose how Cloudflare is routing this app.
      local appd_status appd_hdr appd_body
      mapfile -t appd_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/apps/${app_id}")
      appd_status="${appd_resp[0]}"; appd_hdr="${appd_resp[1]}"; appd_body="${appd_resp[2]}"
      print_kv "APP.${label}.${i}.DETAILS.HTTP_STATUS" "$appd_status"
      if [[ "$appd_status" == "200" ]]; then
        app_detail_hint "$appd_body" | sed "s/^/APP.${label}.${i}.DETAILS./"
      else
        json_hint "$appd_body" | sed "s/^/APP.${label}.${i}.DETAILS./"
      fi

      # Best-effort: infer whether any Access app config could match the v1 API.
      # For Path B, the API may be mounted under /api (so /api/v1/*).
      # IMPORTANT: Many Access apps are configured as self-hosted domains with
      # wildcard paths (e.g. chat.aperion.cc/*) and may not expose explicit "paths".
      local v1_root
      v1_root="${v1_prefix}/v1"

      # Wildcard domain pattern implies all paths are covered.
      if printf '%s' "${app_domains:-}" | grep -Fq "${hostname}/*"; then
        any_paths_cover_v1='yes'
      elif [[ -n "${app_paths:-}" && "${app_paths:-}" != '-' ]]; then
        if printf '%s' "$app_paths" | grep -Eq "(^|,)${v1_root}/\\*($|,)|(^|,)${v1_root}($|,)|(^|,)${v1_root}/identity($|,)|(^|,)${v1_root}/"; then
          any_paths_cover_v1='yes'
        else
          any_paths_cover_v1='no'
        fi
      fi

      # Policies (best-effort)
      local pol_status pol_hdr pol_body
      mapfile -t pol_resp < <(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/apps/${app_id}/policies")
      pol_status="${pol_resp[0]}"; pol_hdr="${pol_resp[1]}"; pol_body="${pol_resp[2]}"

      print_kv "APP.${label}.${i}.POLICIES.HTTP_STATUS" "$pol_status"

      if [[ "$pol_status" != "200" ]]; then
        json_hint "$pol_body" | sed "s/^/APP.${label}.${i}.POLICIES./"
      else
        local pidx=0
        local rows
        rows="$(policy_rows_tsv "$pol_body" || true)"
        while IFS=$'\t' read -r pid pname pdecision phasref phasidvals; do
          [[ -n "$pid" ]] || continue
          print_kv "APP.${label}.${i}.POLICY.${pidx}.ID" "$(redact_id "$pid")"
          print_kv "APP.${label}.${i}.POLICY.${pidx}.NAME" "${pname:-unknown}"
          print_kv "APP.${label}.${i}.POLICY.${pidx}.DECISION" "${pdecision:-UNKNOWN}"
          print_kv "APP.${label}.${i}.POLICY.${pidx}.HAS_SERVICE_TOKEN_REF" "$phasref"
          print_kv "APP.${label}.${i}.POLICY.${pidx}.HAS_SERVICE_TOKEN_ID_VALUES" "${phasidvals:-no}"

          if [[ "$phasref" == 'yes' ]]; then
            any_service_token_ref='yes'
          fi
          if [[ "${phasidvals:-no}" == 'yes' ]]; then
            any_service_token_ids='yes'
          fi
          if printf '%s' "$pdecision" | grep -Eq 'SERVICE|NON_IDENTITY'; then
            any_service_auth_decision='yes'
          fi

          pidx=$((pidx + 1))
        done <<<"$rows"
      fi

      i=$((i + 1))
    done <<<"$matches"

    print_kv "EVIDENCE.${label}.HAS_ANY_SERVICE_TOKEN_REF" "$any_service_token_ref"
    print_kv "EVIDENCE.${label}.POLICY_REFERENCES_SERVICE_TOKEN_IDS" "$any_service_token_ids"
    print_kv "EVIDENCE.${label}.HAS_ANY_SERVICE_AUTH_DECISION" "$any_service_auth_decision"
    print_kv "EVIDENCE.${label}.PATHS_COVER_V1" "$any_paths_cover_v1"

    # Export for summary lines.
    printf -v "policy_service_token_ids_${label}" '%s' "$any_service_token_ids"
  }

  audit_host "$HOST_API" 'API' "$api_path_prefix"
  audit_host "$HOST_CHAT" 'CHAT'

  # Summary: policies commonly reference service tokens by UUID (not client_id).
  # Keep this as an independent fact from CONFIGURED_CLIENT_ID_MATCHES_TOKEN.
  print_kv 'SERVICE_TOKENS.POLICY_REFERENCES_SERVICE_TOKEN_IDS' "${policy_service_token_ids_API:-unknown}"

  # Conclusions grounded in what we can infer.
  print_kv 'CONCLUSION.302.REASON.NO_SERVICE_AUTH_POLICY' 'unknown'
  print_kv 'CONCLUSION.302.REASON.HOSTNAME_CONFLICT' 'unknown'
  print_kv 'CONCLUSION.302.REASON.PATH_MISMATCH' 'unknown'
  print_kv 'CONCLUSION.302.REASON.RETURN_401_FOR_SERVICE_AUTH' 'unknown'
  print_kv 'CONCLUSION.302.REASON.POLICY_PUBLISH_STATE' 'unknown'

  print_kv 'NEXT' 'Run ./dev access:probe (set RUN_NETWORK_TESTS=1) and correlate results with the audit evidence above.'
  print_kv 'NOTE' 'If service-token requests still 302, Cloudflare Access is redirecting (service auth not applied/matching).'
}

if [[ "$want_json" == "yes" ]]; then
  main_text "$@" | node -e "const fs=require('fs'); const lines=fs.readFileSync(0,'utf8').split(/\\r?\\n/).filter(Boolean); const obj={}; for (const line of lines){ const idx=line.indexOf(': '); if (idx<=0) continue; const k=line.slice(0,idx).trim(); const v=line.slice(idx+2); obj[k]=v; } obj.schemaVersion=1; obj.generatedAt=new Date().toISOString(); process.stdout.write(JSON.stringify(obj,null,2)+'\\n');"
else
  main_text "$@"
fi
