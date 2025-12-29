import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, "../../../..");

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(repoRoot, "tools/mcp/aperion/dist/index.js")],
  cwd: repoRoot,
  env: { ...process.env, APERION_REPO_ROOT: repoRoot },
});

const client = new Client(
  { name: "aperion-smoke", version: "0.0.0" },
  { capabilities: {} },
);
await client.connect(transport);

const content = `smoke ${new Date().toISOString()}\n`;
const res = await client.callTool({
  name: "receipts.append",
  arguments: { content },
});

const text = res.content?.[0]?.type === "text" ? res.content[0].text : "";
if (!text.includes("ok:")) {
  throw new Error(`Unexpected response: ${JSON.stringify(res)}`);
}

const rel = text.split(".ref/receipts/")[1]?.trim();
if (!rel) throw new Error(`Could not parse receipt path from: ${text}`);

const abs = path.join(repoRoot, ".ref", "receipts", rel);
if (!fs.existsSync(abs)) throw new Error(`Receipt not written: ${abs}`);

await client.close();
console.log("smoke ok:", abs);
