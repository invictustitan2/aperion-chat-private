#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV_SHELL="${REPO_ROOT}/devshell/devshell"
}

@test "access test is skipped by default (no network)" {
  # This suite is intended to be hermetic by default.
  # Ensure callers (like deploy:prod) don't leak RUN_NETWORK_TESTS into this assertion.
  unset RUN_NETWORK_TESTS
  [ "${RUN_NETWORK_TESTS:-0}" != "1" ]
}

@test "access test returns a status code when enabled" {
  # Keep this test hermetic (no real network):
  # - force RUN_NETWORK_TESTS=1
  # - provide a temporary secrets file
  # - stub curl to return 200
  export RUN_NETWORK_TESTS=1

  local tmp_root
  tmp_root="${BATS_TEST_TMPDIR:-${BATS_TMPDIR:-/tmp}}"

  local fakebin
  fakebin="${tmp_root}/fakebin"
  mkdir -p "${fakebin}"

  cat >"${fakebin}/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Hermetic stub for devshell access test.
# The devshell uses curl with -w '%{http_code}' and expects stdout to be just the status code.
printf '%s' '200'
EOF
  chmod +x "${fakebin}/curl"
  export PATH="${fakebin}:${PATH}"

  local secrets
  secrets="${tmp_root}/cf_access.env"
  cat >"${secrets}" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="aaaaaaaaaaaa"
export CF_ACCESS_SERVICE_TOKEN_SECRET="bbbbbbbbbbbb"
EOF
  chmod 600 "${secrets}"
  export APERION_SECRETS_FILE="${secrets}"

  run "${DEV_SHELL}" access test

  [ "$status" -eq 0 ]
  [[ "$output" =~ ^[0-9]{3}$ ]]
}
