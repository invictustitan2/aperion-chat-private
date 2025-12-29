#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "secrets:wizard refuses to run under bats (no hang)" {
  run env DEV_LOAD_DOTENV=0 "${DEV}" secrets:wizard

  [ "$status" -ne 0 ]
  [[ "$output" == *"disabled under bats"* || "$output" == *"requires an interactive TTY"* ]]
}

@test "secrets:doctor runs and never prints secrets" {
  run env DEV_LOAD_DOTENV=0 "${DEV}" secrets:doctor

  [ "$status" -eq 0 ]

  [[ "$output" == *"Secrets/doctor"* ]]

  # Must not print obvious secret-bearing strings.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}
