# Dev Shell

## One-liner

```bash
./scripts/bootstrap-dev.sh && ./devshell/devshell enter
```

## Secrets

Default secrets file:

- `~/.config/aperion/cf_access.env`

Override:

```bash
APERION_SECRETS_FILE=/path/to/cf_access.env ./devshell/devshell secrets check
```

Create the file (copy/paste):

```bash
mkdir -p "$HOME/.config/aperion"
cat > "$HOME/.config/aperion/cf_access.env" <<'CF_ACCESS_ENV'
export CF_ACCESS_SERVICE_TOKEN_ID="REPLACE_ME"
export CF_ACCESS_SERVICE_TOKEN_SECRET="REPLACE_ME"
CF_ACCESS_ENV
chmod 600 "$HOME/.config/aperion/cf_access.env"
```

## Commands

- `./devshell/devshell enter`
- `./devshell/devshell doctor`
- `./devshell/devshell secrets path`
- `./devshell/devshell secrets check`
- `./devshell/devshell access test`

## Shell tooling (fmt/lint)

The `pnpm` scripts for shell formatting/linting use a NUL-separated file list and pipes (to avoid filename escaping issues):

```bash
./scripts/shell-files.sh shfmt | xargs -0 shfmt -d
./scripts/shell-files.sh shellcheck | xargs -0 shellcheck
```

## Notes

- Secrets are never printed; only lengths and HTTP status codes.
- Network checks are disabled by default. Enable with `RUN_NETWORK_TESTS=1`.

## bootstrap-dev.sh fallbacks

`./scripts/bootstrap-dev.sh` prefers `apt-get` on Debian/Ubuntu, but will fall back when needed:

- **shfmt**: if not available via apt, downloads a pinned official release binary (verifies checksum when possible), or uses `go install` if Go is installed.
- **bats**: if not available via apt, tries `bats-core`, otherwise installs from the upstream `bats-core` repo into `~/.local/bin`.
