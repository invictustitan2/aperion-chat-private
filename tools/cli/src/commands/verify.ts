import chalk from "chalk";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { computeHash } from "@aperion/shared";

export async function verify() {
  console.log(chalk.blue("Verifying environment..."));

  const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
  const authMode = (
    process.env.VITE_AUTH_MODE ||
    process.env.APERION_AUTH_MODE ||
    "access"
  ).toLowerCase();
  const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.VITE_AUTH_TOKEN;

  console.log(chalk.gray(`API URL: ${API_BASE_URL}`));

  const tokenRequired = authMode === "token" || authMode === "hybrid";
  const hasToken = Boolean(AUTH_TOKEN);

  if (tokenRequired && !hasToken) {
    console.error(
      chalk.red(
        "❌ AUTH_TOKEN is missing (required for token/hybrid mode).\n" +
          "   Note: the web UI does not use bearer tokens; Access mode does not require AUTH_TOKEN.",
      ),
    );
    process.exit(1);
  }

  if (hasToken) {
    console.log(chalk.green("✓ AUTH_TOKEN found"));
    const clientFingerprint = computeHash(AUTH_TOKEN!).slice(0, 12);
    console.log(chalk.gray(`Client auth fingerprint: ${clientFingerprint}`));
  } else {
    console.log(chalk.gray("ℹ️  AUTH_TOKEN not set (ok for access mode)."));
  }

  // AWS Check
  console.log(chalk.blue("Checking AWS credentials..."));
  try {
    const client = new STSClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: defaultProvider(),
    });
    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);
    console.log(chalk.green(`✓ AWS Authenticated as ${response.Arn}`));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`⚠️  AWS Authentication failed: ${msg}`));
    console.warn(
      chalk.yellow(`   Run ./scripts/secrets-bootstrap.sh to configure AWS.`),
    );
  }

  try {
    console.log(chalk.blue("Checking connectivity..."));

    const headers: Record<string, string> = {};
    if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;

    const res = await fetch(`${API_BASE_URL}/v1/identity`, {
      headers,
      redirect: "manual",
    });

    const serverFingerprint = res.headers.get("x-aperion-auth-fingerprint");
    const traceId = res.headers.get("x-aperion-trace-id");
    if (traceId) {
      console.log(chalk.gray(`Server trace id: ${traceId}`));
    }
    if (serverFingerprint) {
      console.log(chalk.gray(`Server auth fingerprint: ${serverFingerprint}`));
      if (AUTH_TOKEN) {
        const clientFingerprint = computeHash(AUTH_TOKEN).slice(0, 12);
        if (
          serverFingerprint !== "missing" &&
          serverFingerprint !== clientFingerprint
        ) {
          console.warn(
            chalk.yellow(
              `⚠️  Token mismatch: client(${clientFingerprint}) != server(${serverFingerprint}).\n` +
                `   Fix by updating the Worker secret API_TOKEN and redeploying any token-mode clients from the same token source.`,
            ),
          );
        }
      }
    } else {
      console.warn(
        chalk.yellow(
          "⚠️  Server did not return X-Aperion-Auth-Fingerprint. The API worker may be on an older version.",
        ),
      );
    }

    if (res.ok) {
      if (!AUTH_TOKEN && authMode === "access") {
        console.warn(
          chalk.yellow(
            "⚠️  /v1/identity returned 200 without AUTH_TOKEN. If this is production, double-check Access policies.",
          ),
        );
      }

      console.log(chalk.green("✓ API is reachable"));
      try {
        const data = await res.json();
        console.log(
          chalk.gray(
            `Found ${Array.isArray(data) ? data.length : 0} identity records`,
          ),
        );
      } catch {
        // Some Access configurations may return non-JSON bodies; reachability is the primary goal.
      }
      return;
    }

    // Access mode often yields 401/403 or 302 to an Access login page.
    if (
      authMode === "access" &&
      (res.status === 401 || res.status === 403 || res.status === 302)
    ) {
      console.log(
        chalk.green(
          `✓ API is reachable and appears protected (status ${res.status})`,
        ),
      );
      return;
    }

    console.error(
      chalk.red(`❌ API returned ${res.status}: ${res.statusText}`),
    );
    process.exit(1);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Failed to connect to API: ${msg}`));
    process.exit(1);
  }
}
