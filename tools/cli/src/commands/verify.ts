import chalk from "chalk";

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

  try {
    console.log(chalk.blue("Checking connectivity..."));
    const res = await fetch(`${API_BASE_URL}/v1/identity`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

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
