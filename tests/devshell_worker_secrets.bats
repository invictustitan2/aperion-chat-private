#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "cf:worker:secrets:list skips without RUN_NETWORK_TESTS" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" cf:worker:secrets:list

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: "* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: none"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: yes"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]

  # Must not print secrets or header names.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}

@test "cf:worker:secrets:list --env flag affects effective env (hermetic)" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" cf:worker:secrets:list --env preview

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: preview"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: yes"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]

  # Must not print secrets or header names.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}

@test "cf:worker:secrets:list --env invalid reports VALID: no (hermetic)" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" cf:worker:secrets:list --env notreal

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: notreal"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: no"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]
}

@test "cf:worker:secrets:apply refuses without TTY" {
  export RUN_NETWORK_TESTS=1

  # Seed fake values to ensure we never echo them.
  export APERION_AUTH_MODE="__SECRET_SHOULD_NOT_PRINT__"
  export CF_ACCESS_TEAM_DOMAIN="__SECRET_TEAM_DOMAIN_SHOULD_NOT_PRINT__"
  export CF_ACCESS_AUD="__SECRET_AUD_SHOULD_NOT_PRINT__"

  run "${DEV}" cf:worker:secrets:apply --env preview

  [ "$status" -ne 0 ]
  [[ "$output" == *"REFUSE"* || "$output" == *"TTY"* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: "* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: preview"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: yes"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]

  [[ "$output" != *"__SECRET_SHOULD_NOT_PRINT__"* ]]
  [[ "$output" != *"__SECRET_TEAM_DOMAIN_SHOULD_NOT_PRINT__"* ]]
  [[ "$output" != *"__SECRET_AUD_SHOULD_NOT_PRINT__"* ]]

  # Must not print secrets or header names.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}

@test "cf:worker:secrets:apply --env flag is reflected even when refusing (hermetic)" {
  export RUN_NETWORK_TESTS=1

  run "${DEV}" cf:worker:secrets:apply --env preview

  [ "$status" -ne 0 ]
  [[ "$output" == *"REFUSE"* || "$output" == *"TTY"* ]]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: preview"* ]]
}

@test "cf:worker:secrets:apply rejects invalid env before any Wrangler call" {
  unset RUN_NETWORK_TESTS

  export APERION_AUTH_MODE="__SECRET_SHOULD_NOT_PRINT__"
  export CF_ACCESS_TEAM_DOMAIN="__SECRET_TEAM_DOMAIN_SHOULD_NOT_PRINT__"
  export CF_ACCESS_AUD="__SECRET_AUD_SHOULD_NOT_PRINT__"

  run "${DEV}" cf:worker:secrets:apply --env notreal

  [ "$status" -ne 0 ]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: notreal"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: no"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]

  [[ "$output" != *"__SECRET_SHOULD_NOT_PRINT__"* ]]
  [[ "$output" != *"__SECRET_TEAM_DOMAIN_SHOULD_NOT_PRINT__"* ]]
  [[ "$output" != *"__SECRET_AUD_SHOULD_NOT_PRINT__"* ]]
}
