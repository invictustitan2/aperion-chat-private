#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "secrets:where prints sources without leaking values" {
  run env DEV_LOAD_DOTENV=0 "${DEV}" secrets:where CLOUDFLARE_API_TOKEN

  [ "$status" -eq 0 ]

  # Must include headings and key name.
  [[ "$output" == *"Secrets/where"* ]]
  [[ "$output" == *"CLOUDFLARE_API_TOKEN"* ]]

  # Must not print obvious secret-bearing strings.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}
