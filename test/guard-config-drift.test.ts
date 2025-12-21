import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateConfigDrift } from "../scripts/guard-config-drift.mjs";

async function makeTmpRepo(structure: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aperion-config-drift-"));
  await Promise.all(
    Object.entries(structure).map(async ([rel, content]) => {
      const abs = path.join(dir, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
    }),
  );
  return dir;
}

describe("guard-config-drift", () => {
  it("passes on the real repo", async () => {
    const repoRoot = path.join(process.cwd());
    await expect(validateConfigDrift(repoRoot)).resolves.toBeTruthy();
  });

  it("fails with a precise error when a required worker binding is missing", async () => {
    const repoRoot = await makeTmpRepo({
      "apps/api-worker/wrangler.toml": `name = "x"\nmain = "src/index.ts"\n\n[vars]\n# required_vars:\n# - APERION_AUTH_MODE\n# - CF_ACCESS_TEAM_DOMAIN\n# - CF_ACCESS_AUD\n\n[[d1_databases]]\nbinding = "MEMORY_DB"\ndatabase_name = "x"\ndatabase_id = "x"\n\n[ai]\nbinding = "AI"\n\n[[durable_objects.bindings]]\nname = "CHAT_STATE"\nclass_name = "ChatState"\n\n[env.preview]\nname = "x-preview"\n[env.preview.vars]\n# required_vars:\n# - APERION_AUTH_MODE\n# - CF_ACCESS_TEAM_DOMAIN\n# - CF_ACCESS_AUD\n\n[[env.preview.d1_databases]]\nbinding = "MEMORY_DB"\ndatabase_name = "x"\ndatabase_id = "x"\n\n[[env.preview.durable_objects.bindings]]\nname = "CHAT_STATE"\nclass_name = "ChatState"\n`,
      "apps/web/src/lib/api.ts": `export const x = import.meta.env.VITE_API_BASE_URL;`,
    });

    // Remove AI from default required bindings by breaking the [ai] binding line.
    const wranglerPath = path.join(repoRoot, "apps/api-worker/wrangler.toml");
    const text = await fs.readFile(wranglerPath, "utf8");
    await fs.writeFile(
      wranglerPath,
      text.replace('binding = "AI"', 'binding = "NOT_AI"'),
      "utf8",
    );

    await expect(validateConfigDrift(repoRoot)).rejects.toThrow(
      /Worker bindings missing.*AI/s,
    );
  });

  it("fails if web source references VITE_AUTH_TOKEN", async () => {
    const repoRoot = await makeTmpRepo({
      "apps/api-worker/wrangler.toml": `name = "x"\nmain = "src/index.ts"\n\n[vars]\n# required_vars:\n# - APERION_AUTH_MODE\n# - CF_ACCESS_TEAM_DOMAIN\n# - CF_ACCESS_AUD\n\n[[d1_databases]]\nbinding = "MEMORY_DB"\ndatabase_name = "x"\ndatabase_id = "x"\n\n[ai]\nbinding = "AI"\n\n[[durable_objects.bindings]]\nname = "CHAT_STATE"\nclass_name = "ChatState"\n\n[env.preview]\nname = "x-preview"\n[env.preview.vars]\n# required_vars:\n# - APERION_AUTH_MODE\n# - CF_ACCESS_TEAM_DOMAIN\n# - CF_ACCESS_AUD\n\n[[env.preview.d1_databases]]\nbinding = "MEMORY_DB"\ndatabase_name = "x"\ndatabase_id = "x"\n\n[[env.preview.durable_objects.bindings]]\nname = "CHAT_STATE"\nclass_name = "ChatState"\n`,
      "apps/web/src/lib/api.ts": `console.log(import.meta.env.VITE_API_BASE_URL);\nconsole.log('VITE_AUTH_TOKEN');`,
    });

    await expect(validateConfigDrift(repoRoot)).rejects.toThrow(
      /apps\/web\/src contains a reference to VITE_AUTH_TOKEN/s,
    );
  });
});
