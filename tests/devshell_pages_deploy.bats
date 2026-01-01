#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "cf:pages:deploy prints VITE vars" {
  unset RUN_NETWORK_TESTS
  export DEV_LOAD_DOTENV=0
  export VITE_API_BASE_URL="https://api.aperion.cc"
  export VITE_AUTH_MODE="access"

  run "${DEV}" cf:pages:deploy

  [ "$status" -eq 0 ]
  [[ "$output" == *"PAGES.BUILD.VITE_API_BASE_URL: https://api.aperion.cc"* ]]
  [[ "$output" == *"PAGES.BUILD.VITE_AUTH_MODE: access"* ]]
  [[ "$output" == *"SKIP:"* ]]
}

@test "cf:pages:deploy refuses without --force when base url is not prod" {
  unset RUN_NETWORK_TESTS
  export DEV_LOAD_DOTENV=0
  export VITE_API_BASE_URL="http://localhost:5173"
  export VITE_AUTH_MODE="access"

  run "${DEV}" cf:pages:deploy

  [ "$status" -ne 0 ]
  [[ "$output" == *"PAGES.BUILD.VITE_API_BASE_URL: http://localhost:5173"* ]]
  [[ "$output" == *"REFUSE:"* ]]
}
