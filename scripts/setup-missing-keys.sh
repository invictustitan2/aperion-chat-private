#!/bin/bash
set -e

echo "========================================"
echo "   Aperion Chat Private - Key Setup"
echo "========================================"

# 1. Git SSH Key
echo ""
echo "--- Git SSH Key Check ---"
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "❌ Git SSH key (ed25519) not found."
    echo "We need to generate a new SSH key for git operations."
    read -p "Enter your email address for the SSH key: " email
    
    if [ -n "$email" ]; then
        echo "Generating SSH key..."
        ssh-keygen -t ed25519 -C "$email" -f ~/.ssh/id_ed25519
        eval "$(ssh-agent -s)"
        ssh-add ~/.ssh/id_ed25519
        
        echo "✅ SSH key generated and added to agent."
        echo ""
        echo "⚠️  ACTION REQUIRED: Copy the following public key to your GitHub/GitLab account:"
        echo "--------------------------------------------------------------------------------"
        cat ~/.ssh/id_ed25519.pub
        echo "--------------------------------------------------------------------------------"
        read -p "Press Enter once you have copied the key..."
    else
        echo "⚠️  Skipping SSH key generation (no email provided)."
    fi
else
    echo "✅ Git SSH key found."
fi

# 2. AWS Credentials
echo ""
echo "--- AWS Credentials Check ---"
if [ -z "$AWS_ACCESS_KEY_ID" ] && [ ! -d ~/.aws ]; then
    echo "❌ AWS credentials not found."
    read -p "Do you want to configure AWS credentials now? (y/n) " setup_aws
    if [[ "$setup_aws" =~ ^[Yy]$ ]]; then
        read -p "Enter AWS Access Key ID: " aws_key
        read -s -p "Enter AWS Secret Access Key: " aws_secret
        echo ""
        
        mkdir -p ~/.aws
        cat <<EOF > ~/.aws/credentials
[default]
aws_access_key_id = $aws_key
aws_secret_access_key = $aws_secret
EOF
        echo "✅ AWS credentials saved to ~/.aws/credentials"
    else
        echo "⚠️  Skipping AWS setup."
    fi
else
    echo "✅ AWS credentials already configured."
fi

echo ""
echo "========================================"
echo "   Setup Complete!"
echo "   Run ./scripts/keys-check.sh to verify."
echo "========================================"
