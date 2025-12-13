#!/bin/bash
set -e

echo "Starting bootstrap process..."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for basic dependencies
echo "Checking basic dependencies..."
deps=(git curl unzip jq)
missing_deps=()
for dep in "${deps[@]}"; do
  if ! command_exists "$dep"; then
    missing_deps+=("$dep")
  fi
done

if [ ${#missing_deps[@]} -ne 0 ]; then
  echo "Missing dependencies: ${missing_deps[*]}"
  echo "Please install them using your package manager (e.g., sudo apt-get install ${missing_deps[*]})"
  exit 1
else
  echo "Basic dependencies found."
fi

# Install AWS CLI if not present
if ! command_exists aws; then
  echo "Installing AWS CLI..."
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  sudo ./aws/install || echo "Failed to install AWS CLI with sudo. Please install manually."
  rm -rf aws awscliv2.zip
else
  echo "AWS CLI is already installed."
fi

# Install mise if not present
if ! command_exists mise; then
  echo "Installing mise..."
  curl https://mise.run | sh
  echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
  export PATH="$HOME/.local/bin:$PATH"
  eval "$(mise activate bash)"
else
  echo "mise is already installed."
fi

# Configure mise to install node, python, ripgrep if not already configured in .mise.toml or similar
# We will set up a local config if it doesn't exist
if [ ! -f .mise.toml ]; then
    echo "Creating .mise.toml..."
    cat <<EOF > .mise.toml
[tools]
node = "lts"
python = "3.12"
ripgrep = "latest"
EOF
fi

echo "Installing tools via mise..."
mise trust
mise install

# Check for pnpm
if ! command_exists pnpm; then
    echo "Enabling pnpm via corepack..."
    corepack enable
    corepack prepare pnpm@latest --activate
else
    echo "pnpm is available."
fi

echo "Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Run 'source ~/.bashrc' or restart your shell to ensure mise is loaded."
echo "2. Run './scripts/keys-check.sh' to verify your environment keys and tokens."
echo "3. Open this workspace in VS Code and install recommended extensions."
