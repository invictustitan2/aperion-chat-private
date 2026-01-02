#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:?repo_root required}"
shift

want_json='no'
fail_on_warn='no'

# Defaults: current production surfaces.
pages_host='chat.aperion.cc'
worker_host='api.aperion.cc'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --json)
      want_json='yes'
      ;;
    --fail-on-warn)
      fail_on_warn='yes'
      ;;
    --pages-host)
      if [ -z "${2:-}" ]; then
        printf 'ERROR: --pages-host requires a value\n' >&2
        exit 2
      fi
      pages_host="$2"
      shift
      ;;
    --worker-host|--api-host)
      if [ -z "${2:-}" ]; then
        printf 'ERROR: --worker-host requires a value\n' >&2
        exit 2
      fi
      worker_host="$2"
      shift
      ;;
    -h|--help)
      cat <<'HELP'
Usage:
  ./dev cf:doctor [--json] [--fail-on-warn] [--pages-host host] [--worker-host host]

Read-only Cloudflare deployment preflight checks for:
  - Pages: chat.aperion.cc (default)
  - Worker: api.aperion.cc (default)

Flags:
  --json          Print stable JSON output
  --fail-on-warn  Exit nonzero if any WARN or FAIL
  --pages-host     Override expected Pages hostname (default: chat.aperion.cc)
  --worker-host    Override expected Worker hostname (default: api.aperion.cc)
HELP
      exit 0
      ;;
    *)
      printf 'ERROR: unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
  shift
done

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

json_escape() {
  local s="${1:-}"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

add_check() {
  local id="$1"
  local status="$2"
  local message="$3"
  local data_json="${4:-}"

  local obj
  obj="{\"id\":\"$(json_escape "$id")\",\"status\":\"$(json_escape "$status")\",\"message\":\"$(json_escape "$message")\""
  if [ -n "$data_json" ]; then
    obj+=" ,\"data\":${data_json}"
  fi
  obj+="}"

  checks_json_lines+="$obj"$'\n'

  case "$status" in
    PASS) pass_count=$((pass_count+1)) ;;
    WARN) warn_count=$((warn_count+1)) ;;
    FAIL) fail_count=$((fail_count+1)) ;;
    SKIP) skip_count=$((skip_count+1)) ;;
    *) warn_count=$((warn_count+1)) ;;
  esac
}

pass_count=0
warn_count=0
fail_count=0
skip_count=0
checks_json_lines='' # newline-separated JSON objects

relpath() {
  local path="$1"
  local abs
  abs="$(devshell_abspath_file "$path" 2>/dev/null || true)"
  if [ -z "$abs" ]; then
    printf '%s' "$path"
    return 0
  fi

  local root_abs
  root_abs="$(devshell_abspath_dir "$repo_root")"

  case "$abs" in
    "$root_abs"/*)
      printf '%s' "${abs#"$root_abs"/}"
      ;;
    *)
      printf '%s' "$abs"
      ;;
  esac
}

read_toml_value() {
  local file="$1"
  local key="$2"
  # naive TOML key extractor: key = "value" OR key = 'value'
  # Avoid printing secrets by only extracting names/metadata.
  awk -v k="$key" -F '=' '
    $1 ~ "^"k"[[:space:]]*$" {
      v=$2
      sub(/^[[:space:]]+/, "", v)
      sub(/[[:space:]]+$/, "", v)
      gsub(/^\"|\"$/, "", v)
      gsub(/^\x27|\x27$/, "", v)
      print v
      exit
    }
  ' "$file" 2>/dev/null || true
}

file_contains() {
  local file="$1"
  local needle="$2"
  grep -qF -- "$needle" "$file" 2>/dev/null
}

wrangler_bin='wrangler'
wrangler_present='no'
wrangler_version=''

if devshell_has_cmd "$wrangler_bin"; then
  wrangler_present='yes'
  wrangler_version="$($wrangler_bin --version 2>/dev/null | head -n 1 | devshell_trim || true)"
  add_check "tooling.wrangler" "PASS" "wrangler is installed" "{\"version\":\"$(json_escape "$wrangler_version")\"}"
else
  add_check "tooling.wrangler" "FAIL" "wrangler is not installed (required for Cloudflare checks)" "{}"
fi

authed='no'
if [ "$wrangler_present" = 'yes' ]; then
  if "$wrangler_bin" whoami >/dev/null 2>&1; then
    authed='yes'
    add_check "auth.wrangler" "PASS" "wrangler whoami succeeded (authenticated)" "{}"
  else
    add_check "auth.wrangler" "FAIL" "wrangler whoami failed (not authenticated)" "{\"hint\":\"Run wrangler login (interactive) or set CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID for CI.\"}"
  fi
else
  add_check "auth.wrangler" "SKIP" "skipped auth check because wrangler is missing" "{}"
fi

pages_config_rel="wrangler.toml"
worker_config_rel="apps/api-worker/wrangler.toml"

pages_config_path="${repo_root}/${pages_config_rel}"
worker_config_path="${repo_root}/${worker_config_rel}"

if [ -f "$pages_config_path" ]; then
  add_check "config.pages.wrangler_toml" "PASS" "found Pages wrangler.toml" "{\"path\":\"$(json_escape "$pages_config_rel")\"}"
  if grep -qE '^compatibility_date[[:space:]]*=' "$pages_config_path"; then
    add_check "config.pages.compatibility_date" "PASS" "Pages compatibility_date is set" "{}"
  else
    add_check "config.pages.compatibility_date" "FAIL" "Pages compatibility_date is missing" "{}"
  fi

  # Production bindings expected for Pages runtime (names only; values not inspected)
  missing_pages_bindings=()
  for needle in "env.production.kv_namespaces" "env.production.d1_databases" "env.production.r2_buckets" "env.production.queues.producers" "env.production.ai"; do
    if ! grep -qF -- "$needle" "$pages_config_path"; then
      missing_pages_bindings+=("$needle")
    fi
  done
  if [ "${#missing_pages_bindings[@]}" -eq 0 ]; then
    add_check "config.pages.bindings" "PASS" "Pages production bindings are declared" "{}"
  else
    add_check "config.pages.bindings" "WARN" "Pages production bindings missing/partial (may be intentional): ${missing_pages_bindings[*]}" "{}"
  fi
else
  add_check "config.pages.wrangler_toml" "FAIL" "missing Pages wrangler.toml at repo root" "{\"expectedPath\":\"$(json_escape "$pages_config_rel")\"}"
fi

worker_name=''
worker_preview_name=''

if [ -f "$worker_config_path" ]; then
  add_check "config.worker.wrangler_toml" "PASS" "found Worker wrangler.toml" "{\"path\":\"$(json_escape "$worker_config_rel")\"}"

  worker_name="$(read_toml_value "$worker_config_path" 'name' | head -n 1 | devshell_trim)"
  if [ -n "$worker_name" ]; then
    add_check "config.worker.name" "PASS" "Worker name set" "{\"name\":\"$(json_escape "$worker_name")\"}"
  else
    add_check "config.worker.name" "FAIL" "Worker name missing in wrangler.toml" "{}"
  fi

  if grep -qE '^compatibility_date[[:space:]]*=' "$worker_config_path"; then
    add_check "config.worker.compatibility_date" "PASS" "Worker compatibility_date is set" "{}"
  else
    add_check "config.worker.compatibility_date" "FAIL" "Worker compatibility_date is missing" "{}"
  fi

  # Required bindings expected by this repo (names only; values not inspected)
  missing_worker_bindings=()
  for needle in "[[d1_databases]]" "[[kv_namespaces]]" "[[vectorize]]" "[ai]" "[[durable_objects.bindings]]" "[[queues.producers]]" "[[queues.consumers]]" "[[r2_buckets]]"; do
    if ! grep -qF -- "$needle" "$worker_config_path"; then
      missing_worker_bindings+=("$needle")
    fi
  done

  if [ "${#missing_worker_bindings[@]}" -eq 0 ]; then
    add_check "config.worker.bindings" "PASS" "Worker bindings are declared" "{}"
  else
    add_check "config.worker.bindings" "FAIL" "Worker bindings missing: ${missing_worker_bindings[*]}" "{}"
  fi

  # Deploy intent: worker custom domain
  if grep -qF -- "$worker_host" "$worker_config_path"; then
    add_check "intent.domain.api" "PASS" "Worker config references ${worker_host}" "{\"domain\":\"$(json_escape "$worker_host")\"}"
  else
    add_check "intent.domain.api" "FAIL" "Worker config does not reference ${worker_host}" "{\"domain\":\"$(json_escape "$worker_host")\"}"
  fi

  # Preview worker name is declared under env.preview
  worker_preview_name="$(awk -F '=' 'BEGIN{inprev=0} /^\[env\.preview\]/{inprev=1;next} /^\[/{if($0!="[env.preview]") inprev=0} inprev && $1 ~ /^name[[:space:]]*$/ {v=$2; sub(/^[[:space:]]+/,"",v); sub(/[[:space:]]+$/,"",v); gsub(/^\"|\"$/, "", v); print v; exit}' "$worker_config_path" 2>/dev/null | devshell_trim)"
  if [ -n "$worker_preview_name" ]; then
    add_check "config.worker.preview_name" "PASS" "Preview worker name set" "{\"name\":\"$(json_escape "$worker_preview_name")\"}"
  else
    add_check "config.worker.preview_name" "WARN" "Preview worker name not found under [env.preview]" "{}"
  fi
else
  add_check "config.worker.wrangler_toml" "FAIL" "missing Worker wrangler.toml" "{\"expectedPath\":\"$(json_escape "$worker_config_rel")\"}"
fi

# Deploy intent: expected Pages hostname should be referenced in workflows/docs
chat_domain_claimed='no'
if [ -f "${repo_root}/.github/workflows/deploy-web.yml" ] && grep -qF -- "$pages_host" "${repo_root}/.github/workflows/deploy-web.yml"; then
  chat_domain_claimed='yes'
fi
if [ "$chat_domain_claimed" = 'no' ] && [ -f "${repo_root}/docs/DEPLOY_PROD.md" ] && grep -qF -- "$pages_host" "${repo_root}/docs/DEPLOY_PROD.md"; then
  chat_domain_claimed='yes'
fi

if [ "$chat_domain_claimed" = 'yes' ]; then
  add_check "intent.domain.chat" "PASS" "Repo claims ${pages_host} as the frontend domain" "{\"domain\":\"$(json_escape "$pages_host")\"}"
else
  add_check "intent.domain.chat" "WARN" "Did not find ${pages_host} claim in primary workflow/docs" "{\"domain\":\"$(json_escape "$pages_host")\"}"
fi

# Conflict heuristics (read-only, best-effort)
# Pages project existence
pages_project_name=''
if [ -f "$pages_config_path" ]; then
  pages_project_name="$(read_toml_value "$pages_config_path" 'name' | head -n 1 | devshell_trim)"
fi

if [ -z "$pages_project_name" ]; then
  # Fall back to workflows (authoritative in CI)
  if [ -f "${repo_root}/.github/workflows/deploy-web.yml" ]; then
    pages_project_name="$(awk -F ':' '/projectName:/ {gsub(/^[[:space:]]+/,"",$2); gsub(/^[[:space:]]+/,"",$2); print $2; exit}' "${repo_root}/.github/workflows/deploy-web.yml" | devshell_trim)"
  fi
fi

if [ -n "$pages_project_name" ]; then
  if [ "$wrangler_present" = 'yes' ] && [ "$authed" = 'yes' ]; then
    pages_list_out="$($wrangler_bin pages project list 2>/dev/null)"
    pages_list_rc=$?

    if [ "$pages_list_rc" -ne 0 ]; then
      add_check "conflict.pages.project_exists" "SKIP" "Unable to list Pages projects (wrangler exit $pages_list_rc)" "{\"project\":\"$(json_escape "$pages_project_name")\"}"
    elif [ -z "$(printf '%s' "$pages_list_out" | devshell_trim)" ]; then
      add_check "conflict.pages.project_exists" "SKIP" "Unable to verify Pages project existence (empty list output; permissions or format may differ)" "{\"project\":\"$(json_escape "$pages_project_name")\"}"
    elif printf '%s' "$pages_list_out" | grep -qE "(^|[[:space:]])${pages_project_name}([[:space:]]|$)"; then
      add_check "conflict.pages.project_exists" "PASS" "Pages project exists in account" "{\"project\":\"$(json_escape "$pages_project_name")\"}"
    else
      add_check "conflict.pages.project_exists" "WARN" "Pages project not found in account" "{\"project\":\"$(json_escape "$pages_project_name")\"}"
    fi
  else
    add_check "conflict.pages.project_exists" "SKIP" "Skipped Pages project listing (wrangler missing or unauthenticated)" "{\"project\":\"$(json_escape "$pages_project_name")\"}"
  fi
else
  add_check "conflict.pages.project_exists" "WARN" "Could not determine expected Pages project name" "{}"
fi

# Worker dry-run (optional)
if [ -n "$worker_name" ] && [ "$wrangler_present" = 'yes' ] && [ "$authed" = 'yes' ] && [ -f "$worker_config_path" ]; then
  if "$wrangler_bin" deploy --dry-run --config "$worker_config_path" >/dev/null 2>&1; then
    add_check "conflict.worker.dry_run" "PASS" "wrangler deploy --dry-run succeeded (no mutation)" "{\"worker\":\"$(json_escape "$worker_name")\"}"
  else
    add_check "conflict.worker.dry_run" "WARN" "wrangler deploy --dry-run failed (best-effort check)" "{\"worker\":\"$(json_escape "$worker_name")\"}"
  fi
else
  add_check "conflict.worker.dry_run" "SKIP" "Skipped worker dry-run (missing config, wrangler, auth, or worker name)" "{}"
fi

# Secrets posture (set/unset only)
cf_token_set='no'
cf_account_set='no'
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then cf_token_set='yes'; fi
if [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then cf_account_set='yes'; fi

cf_token_state="$([ "$cf_token_set" = 'yes' ] && echo set || echo unset)"
cf_account_state="$([ "$cf_account_set" = 'yes' ] && echo set || echo unset)"

cf_env_data_json="{\"CLOUDFLARE_API_TOKEN\":\"${cf_token_state}\",\"CLOUDFLARE_ACCOUNT_ID\":\"${cf_account_state}\",\"remediation\":\"Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in GitHub Actions (repo secrets or org/repo vars, depending on your policy).\"}"

if [ "$cf_token_set" = 'yes' ] && [ "$cf_account_set" = 'yes' ]; then
  add_check "secrets.env.cloudflare" "PASS" "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set" "$cf_env_data_json"
else
  missing_cf_vars=()
  if [ "$cf_token_set" != 'yes' ]; then missing_cf_vars+=("CLOUDFLARE_API_TOKEN"); fi
  if [ "$cf_account_set" != 'yes' ]; then missing_cf_vars+=("CLOUDFLARE_ACCOUNT_ID"); fi

  if [ "${#missing_cf_vars[@]}" -eq 1 ]; then
    add_check "secrets.env.cloudflare" "WARN" "${missing_cf_vars[0]} is unset (required for CI deploy workflows)" "$cf_env_data_json"
  else
    add_check "secrets.env.cloudflare" "WARN" "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are unset (required for CI deploy workflows)" "$cf_env_data_json"
  fi
fi

# Secrets posture: ensure .env/.dev.vars are not tracked
tracked_bad=''
if git -C "$repo_root" ls-files --error-unmatch .env >/dev/null 2>&1; then
  tracked_bad+='.env '
fi
if git -C "$repo_root" ls-files --error-unmatch .dev.vars >/dev/null 2>&1; then
  tracked_bad+='.dev.vars '
fi

if [ -z "$tracked_bad" ]; then
  add_check "secrets.tracked.files" "PASS" "No local secrets files are tracked (.env/.dev.vars)" "{}"
else
  add_check "secrets.tracked.files" "FAIL" "Tracked secrets file(s) detected: ${tracked_bad}" "{}"
fi

# Build JSON array from newline-separated objects.
checks_json=''
if [ -n "$checks_json_lines" ]; then
  # Remove trailing newline and join with commas.
  checks_json="$(printf '%s' "$checks_json_lines" | sed '/^$/d' | paste -sd ',' -)"
fi

ok='true'
if [ "$fail_count" -gt 0 ]; then
  ok='false'
fi

if [ "$want_json" = 'yes' ]; then
  printf '{'
  printf '"schemaVersion":1,'
  printf '"surface":{'
  printf '"pages":{'
  printf '"project":"%s"' "$(json_escape "${pages_project_name:-}")"
  printf '},'
  printf '"worker":{'
  printf '"name":"%s",' "$(json_escape "${worker_name:-}")"
  printf '"previewName":"%s"' "$(json_escape "${worker_preview_name:-}")"
  printf '},'
  printf '"domains":{'
  printf '"chat":"%s",' "$(json_escape "$pages_host")"
  printf '"api":"%s"' "$(json_escape "$worker_host")"
  printf '}'
  printf '},'
  printf '"checks":[%s],' "$checks_json"
  printf '"summary":{'
  printf '"pass":%s,' "$pass_count"
  printf '"warn":%s,' "$warn_count"
  printf '"fail":%s,' "$fail_count"
  printf '"skip":%s,' "$skip_count"
  printf '"ok":%s' "$ok"
  printf '},'
  printf '"meta":{'
  printf '"repo":"aperion-chat-private",'
  printf '"paths":{'
  printf '"pagesWranglerToml":"%s",' "$(json_escape "$pages_config_rel")"
  printf '"workerWranglerToml":"%s"' "$(json_escape "$worker_config_rel")"
  printf '}'
  printf '}'
  printf '}'
  printf '\n'
else
  printf 'Cloudflare doctor (read-only)\n'
  printf 'Targets: %s (Pages), %s (Worker)\n\n' "$pages_host" "$worker_host"

  printf 'Checks: PASS=%s WARN=%s FAIL=%s SKIP=%s\n\n' "$pass_count" "$warn_count" "$fail_count" "$skip_count"

  printf '%s' "$checks_json_lines" | sed '/^$/d' | while IFS= read -r obj; do
    id="$(printf '%s' "$obj" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
    status="$(printf '%s' "$obj" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
    message="$(printf '%s' "$obj" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')"

    case "$status" in
      PASS) printf '[PASS] %s — %s\n' "$id" "$message" ;;
      WARN) printf '[WARN] %s — %s\n' "$id" "$message" ;;
      FAIL) printf '[FAIL] %s — %s\n' "$id" "$message" ;;
      SKIP) printf '[SKIP] %s — %s\n' "$id" "$message" ;;
      *) printf '[%s] %s — %s\n' "$status" "$id" "$message" ;;
    esac
  done
fi

if [ "$fail_count" -gt 0 ]; then
  exit 2
fi
if [ "$fail_on_warn" = 'yes' ] && [ "$warn_count" -gt 0 ]; then
  exit 3
fi
exit 0
