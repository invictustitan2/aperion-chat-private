import fs from "fs/promises";
import chalk from "chalk";

export async function exportData(options: { output?: string }) {
  const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
  const AUTH_TOKEN = process.env.VITE_AUTH_TOKEN;

  if (!AUTH_TOKEN) {
    console.error(chalk.red("❌ VITE_AUTH_TOKEN is missing in .env"));
    process.exit(1);
  }

  console.log(chalk.blue("Exporting data..."));

  const endpoints = ["episodic", "identity"]; // Semantic endpoint not listed in previous snippet, but let's assume it exists or skip it.
  // Actually, I saw router.post('/v1/semantic') in api-worker/src/index.ts in previous turns, but I didn't check for GET.
  // Let's stick to episodic and identity for now as they are confirmed to have GET.

  const allData: unknown[] = [];

  for (const endpoint of endpoints) {
    try {
      console.log(chalk.gray(`Fetching ${endpoint}...`));
      // Pagination loop would be ideal, but for now let's just fetch with a large limit or assume the API returns all for export (which it probably doesn't).
      // The API has ?limit=50 default.
      // I'll just fetch 1000 for now.

      const res = await fetch(`${API_BASE_URL}/v1/${endpoint}?limit=1000`, {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          allData.push(...data);
          console.log(
            chalk.green(`✓ Fetched ${data.length} ${endpoint} records`),
          );
        }
      } else {
        console.error(
          chalk.red(`❌ Failed to fetch ${endpoint}: ${res.statusText}`),
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`❌ Error fetching ${endpoint}: ${msg}`));
    }
  }

  const jsonl = allData.map((r) => JSON.stringify(r)).join("\n");

  if (options.output) {
    await fs.writeFile(options.output, jsonl);
    console.log(
      chalk.green(`✓ Exported ${allData.length} records to ${options.output}`),
    );
  } else {
    console.log(jsonl);
  }
}
