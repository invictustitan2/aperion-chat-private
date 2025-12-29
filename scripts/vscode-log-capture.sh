#!/usr/bin/env bash
set -euo pipefail

# VS Code log capture (Linux)
#
# Writes to:
#   receipts/vscode/<YYYY-MM-DD>/<timestamp>/
#
# Hard rules:
# - Never print or persist secrets.
# - Basic redaction runs on captured output.
# - Start/stop safe via pidfile + lockfile.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
receipts_root="${repo_root}/.ref/receipts/vscode"

utc_day() { date -u +%Y-%m-%d; }
utc_stamp() { date -u +%Y-%m-%dT%H-%M-%SZ; }

pid_file="${receipts_root}/.capture.pid"
lock_file="${receipts_root}/.capture.lock"
meta_file="${receipts_root}/.capture.meta"

MAX_BYTES=$((8 * 1024 * 1024))

note() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
err() { printf 'ERROR: %s\n' "$*" >&2; }

discover_logs_root() {
  local base="${HOME}/.config/Code/logs"
  [[ -d "$base" ]] || return 1

  # Find the most recently modified directory under logs/.
  local newest
  newest="$(find "$base" -type d -printf '%T@\t%p\n' 2>/dev/null | sort -nr | head -n 1 | awk -F '\t' '{print $2}')"

  [[ -n "$newest" ]] || return 1
  printf '%s' "$newest"
}

list_log_files() {
  local root="$1"

  # Prefer core logs.
  find "$root" -type f \( \
    -name 'window.log' -o \
    -name 'renderer.log' -o \
    -name 'exthost.log' -o \
    -name 'sharedprocess.log' -o \
    -name '*copilot*.log' -o \
    -name '*agent*.log' \
  \) 2>/dev/null | sort
}

redact_stream() {
  # Best-effort redaction. Replace obvious headers and bearer tokens.
  # Keep this conservative to avoid over-redacting.
  sed -E \
    -e 's/(CF-Access-Client-Id:)[[:space:]]*[^[:space:]]+\b/\1 <REDACTED>/Ig' \
    -e 's/(CF-Access-Client-Secret:)[[:space:]]*[^[:space:]]+\b/\1 <REDACTED>/Ig' \
    -e 's/(Authorization:)[[:space:]]*Bearer[[:space:]]+[^[:space:]]+/\1 Bearer <REDACTED>/Ig' \
    -e 's/\bBearer[[:space:]]+[A-Za-z0-9._\-~=+\/]{24,}\b/Bearer <REDACTED>/g' \
    -e 's/\b(CLOUDFLARE_API_TOKEN|CF_ACCESS_SERVICE_TOKEN_SECRET|CF_ACCESS_SERVICE_TOKEN_ID)=[^[:space:]]+/\1=<REDACTED>/g'
}

rotate_writer() {
  local out_dir="$1"
  local base_name="$2"

  local part=0
  local out_file="${out_dir}/${base_name}.${part}.log"
  : >"$out_file"

  local lines=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s\n' "$line" >>"$out_file"
    lines=$((lines + 1))

    # Check size every 200 lines.
    if (( lines % 200 == 0 )); then
      local sz
      sz="$(stat -c '%s' "$out_file" 2>/dev/null || echo 0)"
      if [[ "$sz" -ge "$MAX_BYTES" ]]; then
        part=$((part + 1))
        out_file="${out_dir}/${base_name}.${part}.log"
        : >"$out_file"
      fi
    fi
  done
}

start_capture() {
  mkdir -p "$receipts_root"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      err "capture already running (pid=${pid})"
      exit 2
    fi
  fi

  if ! ( set -o noclobber; : >"$lock_file" ) 2>/dev/null; then
    err "could not acquire lock (another capture may be starting)"
    exit 2
  fi

  local src_root
  src_root="$(discover_logs_root || true)"
  if [[ -z "$src_root" ]]; then
    rm -f "$lock_file"
    err "VS Code logs root not found under ~/.config/Code/logs"
    exit 2
  fi

  local day stamp out_dir
  day="$(utc_day)"
  stamp="$(utc_stamp)"
  out_dir="${receipts_root}/${day}/${stamp}"
  mkdir -p "$out_dir"

  note "source_logs_root: ${src_root}" >"${out_dir}/meta.txt"

  # Capture list of files.
  local files
  files="$(list_log_files "$src_root" || true)"
  if [[ -z "$files" ]]; then
    warn "no matching log files found; capturing directory listing"
    find "$src_root" -maxdepth 3 -type f -printf '%p\n' 2>/dev/null | head -n 200 >"${out_dir}/files.txt" || true
  else
    printf '%s\n' "$files" >"${out_dir}/files.txt"
  fi

  # Background tailer.
  (
    set -euo pipefail
    {
      if [[ -n "$files" ]]; then
        while IFS= read -r f || [[ -n "$f" ]]; do
          [[ -n "$f" ]] || continue
          # Prefix each line with basename to retain context.
          tail -n 0 -F "$f" 2>/dev/null | sed -u "s/^/[$(basename "$f")]/" &
        done <<<"$files"
        wait
      else
        # Nothing to tail; idle.
        while true; do sleep 5; done
      fi
    } | redact_stream | rotate_writer "$out_dir" "vscode"
  ) &

  local pid=$!
  echo "$pid" >"$pid_file"
  echo "$out_dir" >"$meta_file"
  rm -f "$lock_file"

  note "started: pid=${pid}"
  note "receipts_dir: ${out_dir}"
}

stop_capture() {
  if [[ ! -f "$pid_file" ]]; then
    err "no capture pidfile found"
    exit 2
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    err "pidfile empty"
    exit 2
  fi

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 0.2
    kill -9 "$pid" 2>/dev/null || true
    note "stopped: pid=${pid}"
  else
    warn "pid not running: ${pid}"
  fi

  rm -f "$pid_file"
}

status_capture() {
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      note "running: yes"
      note "pid: ${pid}"
      if [[ -f "$meta_file" ]]; then
        note "receipts_dir: $(cat "$meta_file" 2>/dev/null || true)"
      fi
      exit 0
    fi
  fi

  note "running: no"
  exit 0
}

cmd="${1:-}"
shift || true

case "$cmd" in
  start)
    start_capture
    ;;
  stop)
    stop_capture
    ;;
  status)
    status_capture
    ;;
  *)
    cat <<'HELP'
Usage:
  scripts/vscode-log-capture.sh start
  scripts/vscode-log-capture.sh stop
  scripts/vscode-log-capture.sh status

Writes redacted, rotated VS Code logs to receipts/vscode/.
HELP
    exit 2
    ;;
esac
