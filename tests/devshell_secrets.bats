#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV_SHELL="${REPO_ROOT}/devshell/devshell"
  export TMPDIR_WORK
  TMPDIR_WORK="$(mktemp -d)"

  # Avoid flakiness if the developer running tests already has these exported.
  unset CF_ACCESS_SERVICE_TOKEN_ID
  unset CF_ACCESS_SERVICE_TOKEN_SECRET
}

teardown() {
  rm -rf "${TMPDIR_WORK}"
}

@test "missing secrets file prints mkdir/cat/chmod instructions" {
  export APERION_SECRETS_FILE="${TMPDIR_WORK}/missing.env"

  run "${DEV_SHELL}" secrets check

  [ "$status" -ne 0 ]
  [[ "$output" == *"Missing secrets file:"* ]]
  [[ "$output" == *"mkdir -p"* ]]
  [[ "$output" == *"cat >"* ]]
  [[ "$output" == *"chmod 600"* ]]
  [[ "$output" == *"CF_ACCESS_SERVICE_TOKEN_ID"* ]]
  [[ "$output" == *"CF_ACCESS_SERVICE_TOKEN_SECRET"* ]]
}

@test "env-only secrets pass even when secrets file is missing" {
  export APERION_SECRETS_FILE="${TMPDIR_WORK}/missing.env"
  export CF_ACCESS_SERVICE_TOKEN_ID="dummy-token-id-12345"
  export CF_ACCESS_SERVICE_TOKEN_SECRET="dummy-token-secret-12345"

  run "${DEV_SHELL}" secrets check

  [ "$status" -eq 0 ]
  [[ "$output" == *"OK: CF Access service token present (ID len="* ]]
  [[ "$output" != *"dummy-token-id-12345"* ]]
  [[ "$output" != *"dummy-token-secret-12345"* ]]
  [[ "$output" != *"Missing secrets file:"* ]]
}

@test "missing vars fails with list" {
  local f="${TMPDIR_WORK}/partial.env"
  cat >"$f" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="this-is-long-enough"
EOF

  export APERION_SECRETS_FILE="$f"
  run "${DEV_SHELL}" secrets check

  [ "$status" -ne 0 ]
  [[ "$output" == *"required variables are missing/empty"* ]]
  [[ "$output" == *"CF_ACCESS_SERVICE_TOKEN_SECRET"* ]]
}

@test "placeholder values are rejected (case-insensitive)" {
  local f="${TMPDIR_WORK}/placeholder.env"
  cat >"$f" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="REDACTED"
export CF_ACCESS_SERVICE_TOKEN_SECRET="ChangeMe"
EOF

  export APERION_SECRETS_FILE="$f"
  run "${DEV_SHELL}" secrets check

  [ "$status" -ne 0 ]
  [[ "$output" == *"placeholder"* || "$output" == *"placeholder/redaction"* ]]
}

@test "runs of x are rejected" {
  local f="${TMPDIR_WORK}/x.env"
  cat >"$f" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="xxxxxxxxxxxx"
export CF_ACCESS_SERVICE_TOKEN_SECRET="XXXXXXXXXXXX"
EOF

  export APERION_SECRETS_FILE="$f"
  run "${DEV_SHELL}" secrets check

  [ "$status" -ne 0 ]
  [[ "$output" == *"placeholder"* || "$output" == *"placeholder/redaction"* ]]
}

@test "short values are rejected" {
  local f="${TMPDIR_WORK}/short.env"
  cat >"$f" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="too-short"
export CF_ACCESS_SERVICE_TOKEN_SECRET="too-short"
EOF

  export APERION_SECRETS_FILE="$f"
  run "${DEV_SHELL}" secrets check

  [ "$status" -ne 0 ]
  [[ "$output" == *"too short"* ]]
}

@test "valid values pass and never print values" {
  local f="${TMPDIR_WORK}/ok.env"
  cat >"$f" <<'EOF'
export CF_ACCESS_SERVICE_TOKEN_ID="dummy-token-id-12345"
export CF_ACCESS_SERVICE_TOKEN_SECRET="dummy-token-secret-12345"
EOF

  export APERION_SECRETS_FILE="$f"
  run "${DEV_SHELL}" secrets check

  [ "$status" -eq 0 ]
  [[ "$output" == *"OK: CF Access service token present (ID len="* ]]
  [[ "$output" != *"dummy-token-id-12345"* ]]
  [[ "$output" != *"dummy-token-secret-12345"* ]]
}
