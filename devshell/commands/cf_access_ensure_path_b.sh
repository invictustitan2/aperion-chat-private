#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:access:ensure-path-b
#
# Ensures Cloudflare Access is configured so service-token automation can
# authenticate to the same-origin API mount on https://chat.aperion.cc/api/*.
#
# Strategy (safe + minimal):
# - Find the existing API Access app (api.aperion.cc) and extract the referenced
#   service_token.id from its working NON_IDENTITY policy.
# - Ensure the Chat Access app (chat.aperion.cc) has a NON_IDENTITY policy that
#   references the same service token.
#
# Never prints secrets.

# shellcheck source=devshell/lib/secrets.sh
source "${repo_root}/devshell/lib/secrets.sh"

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network actions.'
  exit 3
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

  cat <<EOF | curl -sS -K -
url = "${url}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
EOF
}

cf_api_post_json() {
  local url="$1"
  local body_json="$2"

  local tmp_body tmp_hdr
  tmp_body="$(mktemp)"
  tmp_hdr="$(mktemp)"

  local status
  status="$(
    cat <<EOF | curl -sS -X POST -D "$tmp_hdr" -o "$tmp_body" -w '%{http_code}' -K -
url = "${url}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
data = ${body_json}
EOF
  )"

  printf '%s\n' "$status"
  cat "$tmp_body"
}

cf_api_put_json() {
  local url="$1"
  local body_json="$2"

  local tmp_body tmp_hdr
  tmp_body="$(mktemp)"
  tmp_hdr="$(mktemp)"

  local status
  status="$(
    cat <<EOF | curl -sS -X PUT -D "$tmp_hdr" -o "$tmp_body" -w '%{http_code}' -K -
url = "${url}"
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
header = "Content-Type: application/json"
data = ${body_json}
EOF
  )"

  printf '%s\n' "$status"
  cat "$tmp_body"
}

json_get() {
  local json="$1"
  local expr="$2"

  node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8'); const data=JSON.parse(input); const out=(${expr}); if (out===undefined||out===null) process.exit(3); if (typeof out==='string') process.stdout.write(out); else process.stdout.write(JSON.stringify(out));" <<<"$json"
}

main() {
  # Load + validate secrets so CF_ACCESS_SERVICE_TOKEN_ID is available.
  aperion_secrets_load
  aperion_secrets_validate >/dev/null

  local missing=0
  need_env CLOUDFLARE_API_TOKEN || missing=1
  need_env CLOUDFLARE_ACCOUNT_ID || missing=1
  if [[ "$missing" -ne 0 ]]; then
    exit 2
  fi

  local account_id
  account_id="$CLOUDFLARE_ACCOUNT_ID"

  echo "== Cloudflare Access ensure Path B (safe; no secrets) =="
  echo "CLOUDFLARE_ACCOUNT_ID=$(redact_id "$account_id")"

  local apps_json
  apps_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps")"

  if [[ "${CF_ACCESS_DEBUG_DUMP:-0}" == "1" ]]; then
    printf '%s' "$apps_json" >"${repo_root}/receipts/cf-access-ensure-path-b.apps.json"
  fi

  if [[ "${CF_ACCESS_DEBUG_DUMP:-0}" == "1" ]]; then
    cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/organizations" \
      >"${repo_root}/receipts/cf-access-ensure-path-b.organizations.json" || true
  fi

  local ok
  ok="$(json_get "$apps_json" "data && data.success")" || true
  if [[ "$ok" != "true" ]]; then
    echo 'ERROR: failed to list Access apps (response not shown).' >&2
    exit 2
  fi

  local api_app_id chat_app_id
  api_app_id="$(APPS_JSON="$apps_json" node - <<'NODE'
const data = JSON.parse(process.env.APPS_JSON || '{}');
const apps = Array.isArray(data.result) ? data.result : [];
function domains(app){
  const out=[];
  if(app && app.domain) out.push(String(app.domain));
  const shd = app && app.self_hosted_domains;
  if(Array.isArray(shd)){
    for(const d of shd){
      if(typeof d==='string') out.push(d);
      else if(d && typeof d==='object') out.push(String(d.domain||d.hostname||''));
    }
  } else if(shd && typeof shd==='object' && Array.isArray(shd.domains)){
    for(const d of shd.domains) out.push(String(d));
  }
  return out.filter(Boolean);
}
function hasHost(app, host){
  const hostLc=host.toLowerCase();
  return domains(app).some(d => String(d).toLowerCase().includes(hostLc));
}
const match = apps.find(a => hasHost(a,'api.aperion.cc'));
process.stdout.write(String(match && match.id || ''));
NODE
)"

  chat_app_id="$(APPS_JSON="$apps_json" node - <<'NODE'
const data = JSON.parse(process.env.APPS_JSON || '{}');
const apps = Array.isArray(data.result) ? data.result : [];
function domains(app){
  const out=[];
  if(app && app.domain) out.push(String(app.domain));
  const shd = app && app.self_hosted_domains;
  if(Array.isArray(shd)){
    for(const d of shd){
      if(typeof d==='string') out.push(d);
      else if(d && typeof d==='object') out.push(String(d.domain||d.hostname||''));
    }
  } else if(shd && typeof shd==='object' && Array.isArray(shd.domains)){
    for(const d of shd.domains) out.push(String(d));
  }
  return out.filter(Boolean);
}
function hasHost(app, host){
  const hostLc=host.toLowerCase();
  return domains(app).some(d => String(d).toLowerCase().includes(hostLc));
}
const match = apps.find(a => hasHost(a,'chat.aperion.cc'));
process.stdout.write(String(match && match.id || ''));
NODE
)"

  if [[ -z "$api_app_id" ]]; then
    echo 'ERROR: could not find Access app matching api.aperion.cc.' >&2
    exit 2
  fi

  if [[ -z "$chat_app_id" ]]; then
    echo 'ERROR: could not find Access app matching chat.aperion.cc.' >&2
    exit 2
  fi

  # Ensure the Chat app is configured to support Service Auth (matches API app).
  local chat_service_auth
  chat_service_auth="$(APPS_JSON="$apps_json" CHAT_APP_ID="$chat_app_id" node - <<'NODE'
const data = JSON.parse(process.env.APPS_JSON || '{}');
const apps = Array.isArray(data.result) ? data.result : [];
const wantId = String(process.env.CHAT_APP_ID || '');
const app = apps.find(a => a && String(a.id || '') === wantId) || null;
const v = app && Object.prototype.hasOwnProperty.call(app, 'service_auth_401_redirect') ? app.service_auth_401_redirect : undefined;
process.stdout.write(String(v === true ? 'true' : 'false'));
NODE
)" || true

  if [[ "$chat_service_auth" != 'true' ]]; then
    echo 'MUTATION: enabling service_auth_401_redirect on Chat app (safe; no secrets).'
    local patch_body
    patch_body="$(APPS_JSON="$apps_json" CHAT_APP_ID="$chat_app_id" node - <<'NODE'
const data = JSON.parse(process.env.APPS_JSON || '{}');
const apps = Array.isArray(data.result) ? data.result : [];
const wantId = String(process.env.CHAT_APP_ID || '');
const app = apps.find(a => a && String(a.id || '') === wantId) || null;
if (!app) process.exit(3);

// Construct a PUT payload using current app settings, and only mutate the
// service_auth_401_redirect flag.
const body = {
  type: String(app.type || 'self_hosted'),
  name: String(app.name || ''),
  aud: String(app.aud || ''),
  domain: String(app.domain || ''),
  self_hosted_domains: Array.isArray(app.self_hosted_domains) ? app.self_hosted_domains : [],
  destinations: Array.isArray(app.destinations) ? app.destinations : [],
  app_launcher_visible: Boolean(app.app_launcher_visible),
  allowed_idps: Array.isArray(app.allowed_idps) ? app.allowed_idps : [],
  tags: Array.isArray(app.tags) ? app.tags : [],
  session_duration: String(app.session_duration || '24h'),
  auto_redirect_to_identity: Boolean(app.auto_redirect_to_identity),
  enable_binding_cookie: Boolean(app.enable_binding_cookie),
  http_only_cookie_attribute: Boolean(app.http_only_cookie_attribute),
  options_preflight_bypass: Boolean(app.options_preflight_bypass),
  service_auth_401_redirect: true
};

process.stdout.write(JSON.stringify(body));
NODE
)" || true

    if [[ -z "$patch_body" ]]; then
      echo 'ERROR: could not construct Chat app update payload.' >&2
      exit 2
    fi

    printf '%s' "$patch_body" >"${repo_root}/receipts/cf-access-ensure-path-b.patch-chat-app.request.json"

    local patch_resp patch_status patch_json
    patch_resp="$(cf_api_put_json "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps/${chat_app_id}" "$patch_body")"
    patch_status="${patch_resp%%$'\n'*}"
    if [[ "$patch_resp" == *$'\n'* ]]; then
      patch_json="${patch_resp#*$'\n'}"
    else
      patch_json=''
    fi

    printf '%s' "$patch_json" >"${repo_root}/receipts/cf-access-ensure-path-b.patch-chat-app.response.json"
    printf '%s' "${patch_status:-}" >"${repo_root}/receipts/cf-access-ensure-path-b.patch-chat-app.response.http_status.txt"

    local patch_ok
    patch_ok="$(json_get "$patch_json" "data && data.success")" || true
    if [[ "$patch_ok" != 'true' ]]; then
      echo 'WARN: failed to update Chat Access app settings to enable service auth (will continue; policy create may still work).' >&2
      echo "HTTP status: ${patch_status}" >&2
      CREATE_JSON="$patch_json" node - <<'NODE' >&2 || true
try {
  const data = JSON.parse(process.env.CREATE_JSON || '{}');
  const errors = Array.isArray(data.errors) ? data.errors : [];
  if (!errors.length) process.stderr.write('No Cloudflare errors field present.\n');
  for (const e of errors.slice(0, 10)) {
    const code = e && e.code !== undefined ? String(e.code) : '(no code)';
    const msg = e && e.message ? String(e.message) : '(no message)';
    process.stderr.write(`- code=${code} message=${msg}\n`);
  }
} catch {
  process.stderr.write('Failed to parse Cloudflare JSON response.\n');
}
NODE
    fi
  fi

  echo "ACCESS_APP_ID.API=$(redact_id "$api_app_id")"
  echo "ACCESS_APP_ID.CHAT=$(redact_id "$chat_app_id")"

  local api_policies_json
  api_policies_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps/${api_app_id}/policies")"
  if [[ "${CF_ACCESS_DEBUG_DUMP:-0}" == "1" ]]; then
    printf '%s' "$api_policies_json" >"${repo_root}/receipts/cf-access-ensure-path-b.api-policies.json"
  fi

  ok="$(json_get "$api_policies_json" "data && data.success")" || true
  if [[ "$ok" != "true" ]]; then
    echo 'ERROR: failed to list Access policies for API app (response not shown).' >&2
    exit 2
  fi

  # Extract the Service Auth policy from the API app so we can clone its include rule.
  local service_policy_json
  service_policy_json="$(POLICIES_JSON="$api_policies_json" node - <<'NODE'
const data = JSON.parse(process.env.POLICIES_JSON || '{}');
const list = Array.isArray(data.result) ? data.result : [];

function upper(s){ return String(s||'').toUpperCase(); }
function isNonIdentity(p){ return upper(p && p.decision) === 'NON_IDENTITY'; }

let hit = list.find(p => isNonIdentity(p) && String(p && p.name || '').includes('aperion-api-prod-smoke'));
if (!hit) hit = list.find(p => isNonIdentity(p));

if (!hit) process.exit(3);

// Create a minimal payload for POSTing to the Chat app.
// (Cloudflare may reject extra fields depending on token scheme / endpoint version.)
const out = {
  name: String(hit.name || 'Allow service token'),
  decision: String(hit.decision || 'non_identity'),
  include: hit.include || []
};

process.stdout.write(JSON.stringify(out));
NODE
)" || true

  if [[ -z "$service_policy_json" ]]; then
    echo 'ERROR: could not extract a NON_IDENTITY (Service Auth) policy from the API Access app.' >&2
    echo 'Hint: create/confirm a Service Auth policy for api.aperion.cc first, then re-run.' >&2
    exit 2
  fi

  local service_token_id
  service_token_id="$(SERVICE_POLICY_JSON="$service_policy_json" node - <<'NODE'
const data = JSON.parse(process.env.SERVICE_POLICY_JSON || '{}');
const include = Array.isArray(data.include) ? data.include : [];
let tokenId='';
for (const rule of include) {
  if (!rule || typeof rule !== 'object') continue;
  const st = rule.service_token || rule.serviceToken;
  if (st && typeof st === 'object') {
    const v = String(st.token_id || st.tokenId || st.id || '');
    if (v) { tokenId = v; break; }
  }
}
process.stdout.write(tokenId);
NODE
)" || true

  if [[ -z "$service_token_id" ]]; then
    echo 'ERROR: could not extract service_token.token_id from the API Service Auth policy include rules.' >&2
    exit 2
  fi

  echo "SERVICE_TOKEN.ID=$(redact_id "$service_token_id")"

  local chat_policies_json
  chat_policies_json="$(cf_api_get "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps/${chat_app_id}/policies")"

  if [[ "${CF_ACCESS_DEBUG_DUMP:-0}" == "1" ]]; then
    printf '%s' "$chat_policies_json" >"${repo_root}/receipts/cf-access-ensure-path-b.chat-policies.json"
  fi

  ok="$(json_get "$chat_policies_json" "data && data.success")" || true
  if [[ "$ok" != "true" ]]; then
    echo 'ERROR: failed to list Access policies for Chat app (response not shown).' >&2
    exit 2
  fi

  local already
  already="$(WANT_SERVICE_TOKEN_ID="$service_token_id" POLICIES_JSON="$chat_policies_json" node - <<'NODE'
const data = JSON.parse(process.env.POLICIES_JSON || '{}');
const list = Array.isArray(data.result) ? data.result : [];
const want = String(process.env.WANT_SERVICE_TOKEN_ID||'');

function upper(s){ return String(s||'').toUpperCase(); }

function hasTokenRef(obj){
  const seen=new Set();
  let hit=false;
  function walk(v){
    if(hit) return;
    if(!v || typeof v!=='object') return;
    if(seen.has(v)) return;
    seen.add(v);

    if(Object.prototype.hasOwnProperty.call(v,'service_token') || Object.prototype.hasOwnProperty.call(v,'serviceToken')){
      const st=v.service_token || v.serviceToken;
      if(st && typeof st==='object'){
        const id=String(st.token_id || st.tokenId || st.id || '');
        if(id && id===want) { hit=true; return; }
      }
    }

    for(const k of Object.keys(v)) walk(v[k]);
  }
  walk(obj);
  return hit;
}

for(const p of list){
  const decision = upper(p && (p.decision||p.action||p.effect||''));
  if(decision !== 'NON_IDENTITY') continue;
  if(hasTokenRef(p)) { process.stdout.write('yes'); process.exit(0); }
}
process.stdout.write('no');
NODE
)" || true

  if [[ "$already" == 'yes' ]]; then
    echo 'OK: Chat app already has a Service Auth policy for the configured service token.'
    exit 0
  fi

  echo 'MUTATION: creating Service Auth policy on Chat app (safe; no secrets).'

  mkdir -p "${repo_root}/receipts" >/dev/null 2>&1 || true
  printf '%s' "$service_policy_json" >"${repo_root}/receipts/cf-access-ensure-path-b.request.json"

  local create_status create_json create_resp
  create_resp="$(cf_api_post_json "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps/${chat_app_id}/policies" "$service_policy_json")"
  create_status="${create_resp%%$'\n'*}"
  if [[ "$create_resp" == *$'\n'* ]]; then
    create_json="${create_resp#*$'\n'}"
  else
    create_json=''
  fi

  printf '%s' "$create_json" >"${repo_root}/receipts/cf-access-ensure-path-b.response.json"
  printf '%s' "${create_status:-}" >"${repo_root}/receipts/cf-access-ensure-path-b.response.http_status.txt"

  ok="$(json_get "$create_json" "data && data.success")" || true
  if [[ "$ok" != "true" ]]; then
    echo 'ERROR: failed to create Service Auth policy on Chat app.' >&2
    if [[ -n "${create_status:-}" ]]; then
      echo "HTTP status: ${create_status}" >&2
    fi
    CREATE_JSON="$create_json" node - <<'NODE' >&2 || true
try {
  const data = JSON.parse(process.env.CREATE_JSON || '{}');
  const errors = Array.isArray(data.errors) ? data.errors : [];
  if (!errors.length) {
    process.stderr.write('No Cloudflare errors field present.\n');
  } else {
    process.stderr.write('Cloudflare errors:\n');
    for (const e of errors.slice(0, 10)) {
      const code = e && e.code !== undefined ? String(e.code) : '(no code)';
      const msg = e && e.message ? String(e.message) : '(no message)';
      process.stderr.write(`- code=${code} message=${msg}\n`);
    }
  }
} catch {
  process.stderr.write('Failed to parse Cloudflare JSON response.\n');
}
NODE
    exit 2
  fi

  local new_policy_id
  new_policy_id="$(json_get "$create_json" "data && data.result && data.result.id")" || true
  if [[ -n "$new_policy_id" ]]; then
    echo "OK: created policy id=$(redact_id "$new_policy_id")"
  else
    echo 'OK: attached policy (id not returned).'
  fi

  echo 'NEXT: re-run ./dev access:probe --surface browser (RUN_NETWORK_TESTS=1) to confirm service-token requests no longer redirect.'
}

WANT_SERVICE_TOKEN_UUID='' main "$@"
