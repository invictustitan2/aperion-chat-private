import fs from "fs/promises";
import chalk from "chalk";
import inquirer from "inquirer";
import YAML from "yaml";
import path from "path";

export async function seed(file: string, options: { confirm?: boolean }) {
  const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
  const AUTH_TOKEN = process.env.VITE_AUTH_TOKEN;

  if (!AUTH_TOKEN) {
    console.error(chalk.red("❌ VITE_AUTH_TOKEN is missing in .env"));
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), file);
  console.log(chalk.blue(`Reading seed file: ${filePath}`));

  let content;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Failed to read file: ${msg}`));
    process.exit(1);
  }

  const data = YAML.parse(content);
  if (!Array.isArray(data)) {
    console.error(chalk.red("❌ Seed file must contain an array of records"));
    process.exit(1);
  }

  console.log(chalk.gray(`Found ${data.length} records to seed.`));

  if (!options.confirm) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `This will insert ${data.length} records into the identity memory. Continue?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("Seed cancelled."));
      return;
    }
  }

  console.log(chalk.blue("Seeding..."));

  let successCount = 0;
  let failCount = 0;

  for (const record of data) {
    try {
      const payload = {
        key: record.key,
        value: record.value,
        provenance: record.provenance || {
          source_type: "seed",
          source_id: "cli",
        },
      };

      const res = await fetch(`${API_BASE_URL}/v1/identity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        successCount++;
        process.stdout.write(chalk.green("."));
      } else {
        failCount++;
        process.stdout.write(chalk.red("x"));
        await res.text();
        // console.error(chalk.red(`\nFailed to seed ${record.key}: ${err}`));
      }
    } catch (e: unknown) {
      failCount++;
      process.stdout.write(chalk.red("E"));
    }
  }

  console.log("\n");
  console.log(chalk.green(`✓ Seeded ${successCount} records.`));
  if (failCount > 0) {
    console.log(chalk.red(`❌ Failed to seed ${failCount} records.`));
  }
}
