#!/usr/bin/env bash
set -euo pipefail

# Installs/verifies developer tool dependencies for the dev shell.
# Primary target: Ubuntu 24.04 / Debian-ish (apt-get).

LOCAL_BIN="${HOME}/.local/bin"

SHFMT_VERSION="v3.12.0"
SHFMT_ASSET="shfmt_${SHFMT_VERSION}_linux_amd64"
SHFMT_URL="https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/${SHFMT_ASSET}"
SHFMT_CHECKSUMS_URL="https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/checksums.txt"

usage() {
  cat <<'HELP'
Usage:
  ./scripts/bootstrap-dev.sh [--check]

Modes:
  --check   Verify required tools exist; do not install.

Installs (apt):
  curl jq ripgrep shellcheck shfmt bats

Notes:
  - If apt-get is unavailable, prints manual suggestions and exits nonzero.
  - Fallbacks:
    - shfmt: if not available via apt, downloads pinned release binary (with checksum verification when possible),
      or uses 'go install mvdan.cc/sh/v3/cmd/shfmt@<version>' if Go is installed.
    - bats: if not available via apt, tries bats-core, otherwise installs from bats-core git repo.
HELP
}

check_only=0
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ "${1:-}" == "--check" ]]; then
  check_only=1
fi

need() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1
}

ensure_path() {
  mkdir -p "${LOCAL_BIN}"
  case ":${PATH}:" in
  *":${LOCAL_BIN}:"*) ;;
  *) export PATH="${LOCAL_BIN}:${PATH}" ;;
  esac
}

have_bats() {
  need bats || need bats-core
}

print_bats_name() {
  if need bats; then
    printf '%s' bats
    return 0
  fi
  if need bats-core; then
    printf '%s' bats-core
    return 0
  fi
  return 1
}

require_all() {
  local missing=0

  ensure_path

  for cmd in bash curl jq rg shellcheck shfmt; do
    if need "$cmd"; then
      printf 'OK: %s\n' "$cmd"
    else
      printf 'MISSING: %s\n' "$cmd" >&2
      missing=1
    fi
  done

  if have_bats; then
    printf 'OK: %s\n' "$(print_bats_name)"
  else
    printf 'MISSING: bats (or bats-core)\n' >&2
    missing=1
  fi

  return $missing
}

apt_install() {
  local pkgs=("$@")

  "${sudo_cmd[@]}" apt-get update -y
  if "${sudo_cmd[@]}" apt-get install -y "${pkgs[@]}"; then
    return 0
  fi
  return 1
}

install_shfmt_fallback() {
  ensure_path

  if need shfmt; then
    return 0
  fi

  echo "Installing shfmt (${SHFMT_VERSION}) fallback..."

  if need curl; then
    local tmpdir
    tmpdir="$(mktemp -d)"

    local bin_path="${tmpdir}/${SHFMT_ASSET}"
    if curl -fsSL "${SHFMT_URL}" -o "${bin_path}"; then
      local expected='' actual=''
      if need sha256sum; then
        if curl -fsSL "${SHFMT_CHECKSUMS_URL}" -o "${tmpdir}/checksums.txt"; then
          expected="$(grep " ${SHFMT_ASSET}$" "${tmpdir}/checksums.txt" | awk '{print $1}' || true)"
          actual="$(sha256sum "${bin_path}" | awk '{print $1}')"
          if [[ -n "${expected}" && "${expected}" != "${actual}" ]]; then
            echo "ERROR: shfmt checksum verification failed" >&2
            echo "Expected: ${expected}" >&2
            echo "Actual:   ${actual}" >&2
            return 1
          fi
        else
          echo "WARN: could not download shfmt checksums; proceeding without verification" >&2
        fi
      else
        echo "WARN: sha256sum not found; proceeding without checksum verification" >&2
      fi

      chmod 0755 "${bin_path}"
      mv "${bin_path}" "${LOCAL_BIN}/shfmt"
      echo "Installed shfmt to ${LOCAL_BIN}/shfmt"
      rm -rf "${tmpdir}"
      return 0
    fi

    rm -rf "${tmpdir}"
  fi

  if need go; then
    echo "Falling back to Go install for shfmt (${SHFMT_VERSION})..."
    go install "mvdan.cc/sh/v3/cmd/shfmt@${SHFMT_VERSION}"
    local gopath
    gopath="$(go env GOPATH)"
    if [[ -x "${gopath}/bin/shfmt" ]]; then
      mkdir -p "${LOCAL_BIN}"
      cp "${gopath}/bin/shfmt" "${LOCAL_BIN}/shfmt"
      chmod 0755 "${LOCAL_BIN}/shfmt"
      echo "Installed shfmt to ${LOCAL_BIN}/shfmt"
      return 0
    fi
  fi

  echo "ERROR: unable to install shfmt (need apt package, or curl+github, or go)" >&2
  return 1
}

install_bats_fallback() {
  ensure_path

  if need bats || need bats-core; then
    return 0
  fi

  echo "Installing bats fallback..."

  # If apt didn't provide bats, try bats-core as an alternate package name.
  if "${sudo_cmd[@]}" apt-get install -y bats-core >/dev/null 2>&1; then
    if need bats || need bats-core; then
      return 0
    fi
  fi

  if ! need git; then
    echo "ERROR: git is required to install bats-core fallback" >&2
    return 1
  fi

  local tmpdir
  tmpdir="$(mktemp -d)"

  git clone --depth 1 https://github.com/bats-core/bats-core.git "${tmpdir}/bats-core" >/dev/null 2>&1
  "${tmpdir}/bats-core/install.sh" "${HOME}/.local" >/dev/null
  rm -rf "${tmpdir}"
  if need bats; then
    return 0
  fi

  echo "ERROR: bats install fallback did not produce a 'bats' command" >&2
  return 1
}

if ! command -v apt-get >/dev/null 2>&1; then
  cat >&2 <<'EOF'
ERROR: apt-get not found. This script currently supports Debian/Ubuntu (apt) only.

Manual install suggestions:
  - curl, jq, ripgrep (rg), shellcheck, shfmt, bats-core

Examples:
  - macOS (Homebrew): brew install curl jq ripgrep shellcheck shfmt bats-core
  - Fedora: sudo dnf install curl jq ripgrep ShellCheck shfmt bats
EOF
  exit 1
fi

if [[ $check_only -eq 1 ]]; then
  require_all
  exit $?
fi

sudo_cmd=()
if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    sudo_cmd=(sudo)
  else
    echo "ERROR: need root privileges to install packages (sudo not found)." >&2
    exit 1
  fi
fi

"${sudo_cmd[@]}" apt-get update -y

# Prefer apt for baseline tooling.
apt_install curl jq ripgrep shellcheck || true

# Try to install shfmt and bats via apt, but allow fallbacks.
"${sudo_cmd[@]}" apt-get install -y shfmt >/dev/null 2>&1 || true
"${sudo_cmd[@]}" apt-get install -y bats >/dev/null 2>&1 || true

install_shfmt_fallback
install_bats_fallback

ensure_path

echo ""
echo "Toolchain verification:"
require_all

echo ""
echo "Bootstrap complete. Verify:"
echo "  ./scripts/bootstrap-dev.sh --check"
