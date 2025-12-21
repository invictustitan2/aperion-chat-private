#!/usr/bin/env node
/**
 * Generate a cryptographically secure API token for Aperion Chat
 *
 * Usage:
 *   npx tsx scripts/generate-api-token.ts
 *
 * This generates a 256-bit (32-byte) random token encoded in base64url format.
 * The token should be set in:
 * - GitHub Secrets: API_TOKEN
 * - Cloudflare Worker: wrangler secret put API_TOKEN
 * - Local scripts/curl (optional): AUTH_TOKEN
 *
 * Note: Production and the web UI use Cloudflare Access (JWT/JWKS). This token is legacy
 * and is only relevant for local API-only development in token/hybrid auth modes.
 */

import { randomBytes } from "crypto";

function generateSecureToken(bytes: number = 32): string {
  // Generate cryptographically secure random bytes
  const buffer = randomBytes(bytes);

  // Convert to base64url (URL-safe base64 without padding)
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function main() {
  console.log("🔐 Aperion Chat - API Token Generator\n");

  // Generate a new token
  const token = generateSecureToken(32); // 256 bits

  console.log("✅ Generated new API token (256-bit):\n");
  console.log(`   ${token}\n`);

  console.log("📋 Setup Instructions:\n");
  console.log("1. GitHub Secrets (for CI/CD):");
  console.log("   - Go to: Settings → Secrets and variables → Actions");
  console.log("   - Add secret: API_TOKEN");
  console.log(`   - Value: ${token}\n`);

  console.log("2. Cloudflare Worker (Backend):");
  console.log("   - Run: cd apps/api-worker");
  console.log(`   - Run: echo "${token}" | wrangler secret put API_TOKEN\n`);

  console.log("3. Local API-only development (optional legacy token):");
  console.log("   - Add to .env file for scripts/curl:");
  console.log(`   AUTH_TOKEN=${token}\n`);

  console.log("⚠️  Security Notes:");
  console.log("   - Keep this token secret and secure");
  console.log("   - Never commit it to version control");
  console.log("   - Rotate periodically for security");
  console.log("   - This token is not used by the web UI in production\n");

  console.log("🔄 Token Rotation:");
  console.log("   - Generate a new token using this script");
  console.log("   - Update all 4 locations above");
  console.log("   - Redeploy both Worker and Pages\n");
}

main();
