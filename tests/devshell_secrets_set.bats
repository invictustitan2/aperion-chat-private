#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "secrets:set refuses to run without a TTY (no hang)" {
  run env DEV_LOAD_DOTENV=0 "${DEV}" secrets:set CLOUDFLARE_API_TOKEN

  [ "$status" -ne 0 ]
  [[ "$output" == *"disabled under bats"* || "$output" == *"requires an interactive TTY"* ]]
}
