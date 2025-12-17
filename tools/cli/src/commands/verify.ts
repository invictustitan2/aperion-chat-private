import chalk from "chalk";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { computeHash } from "@aperion/shared";

export async function verify() {
  console.log(chalk.blue("Verifying environment..."));

  const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
  const AUTH_TOKEN = process.env.VITE_AUTH_TOKEN;

  console.log(chalk.gray(`API URL: ${API_BASE_URL}`));

  if (!AUTH_TOKEN) {
    console.error(chalk.red("❌ VITE_AUTH_TOKEN is missing in .env"));
    process.exit(1);
  } else {
    console.log(chalk.green("✓ VITE_AUTH_TOKEN found"));
  }

  const clientFingerprint = computeHash(AUTH_TOKEN).slice(0, 12);
  console.log(chalk.gray(`Client auth fingerprint: ${clientFingerprint}`));

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
    const res = await fetch(`${API_BASE_URL}/v1/identity`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    const serverFingerprint = res.headers.get("x-aperion-auth-fingerprint");
    const traceId = res.headers.get("x-aperion-trace-id");
    if (traceId) {
      console.log(chalk.gray(`Server trace id: ${traceId}`));
    }
    if (serverFingerprint) {
      console.log(chalk.gray(`Server auth fingerprint: ${serverFingerprint}`));
      if (
        serverFingerprint !== "missing" &&
        serverFingerprint !== clientFingerprint
      ) {
        console.warn(
          chalk.yellow(
            `⚠️  Token mismatch: client(${clientFingerprint}) != server(${serverFingerprint}).\n` +
              `   Fix by updating the Worker secret API_TOKEN and redeploying the web build from the same token source.`,
          ),
        );
      }
    } else {
      console.warn(
        chalk.yellow(
          "⚠️  Server did not return X-Aperion-Auth-Fingerprint. The API worker may be on an older version.",
        ),
      );
    }

    if (res.ok) {
      console.log(chalk.green("✓ API is reachable and auth is valid"));
      const data = await res.json();
      console.log(
        chalk.gray(
          `Found ${Array.isArray(data) ? data.length : 0} identity records`,
        ),
      );
    } else {
      console.error(
        chalk.red(`❌ API returned ${res.status}: ${res.statusText}`),
      );
      process.exit(1);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Failed to connect to API: ${msg}`));
    process.exit(1);
  }
}
