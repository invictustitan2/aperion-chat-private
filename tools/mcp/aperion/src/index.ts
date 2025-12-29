import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { appendReceipt } from "./receipts.js";
import { repoSearch } from "./repoSearch.js";
import { secretsStatus } from "./secretsStatus.js";
import { memoryIngestReceipt } from "./memoryIngest.js";

const repoRoot = process.env.APERION_REPO_ROOT ?? process.cwd();

const server = new McpServer({ name: "aperion", version: "0.0.0" });

const ReceiptsAppendInput = z.object({
  relativePath: z.string().optional(),
  content: z.string(),
});

server.registerTool(
  "receipts.append",
  {
    description:
      "Append a receipt into .ref/receipts/ (path restricted to that directory).",
    inputSchema: ReceiptsAppendInput,
  },
  async (args: z.infer<typeof ReceiptsAppendInput>) => {
    const { relativePath, content } = args;
    const { relativePath: rel } = appendReceipt({
      repoRoot,
      relativePath,
      content,
    });
    return {
      content: [{ type: "text", text: `ok: appended to .ref/receipts/${rel}` }],
    };
  },
);

const RepoSearchInput = z.object({
  query: z.string(),
  include: z.string().optional(),
  maxResults: z.number().int().optional(),
});

server.registerTool(
  "repo.search",
  {
    description: "Search the repo via ripgrep (rg).",
    inputSchema: RepoSearchInput,
  },
  async (args: z.infer<typeof RepoSearchInput>) => {
    const { query, include, maxResults } = args;
    const res = repoSearch({ repoRoot, query, include, maxResults });
    if (!res.ok) {
      return {
        content: [
          { type: "text", text: `error: ${res.error ?? "search failed"}` },
        ],
      };
    }
    const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "(no matches)" }] };
  },
);

server.registerTool(
  "secrets.status",
  {
    description:
      "Run ./dev secrets:status (output is already redacted by the devshell).",
  },
  async () => {
    const res = secretsStatus({ repoRoot });
    const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out }] };
  },
);

const MemoryIngestInput = z.object({
  content: z.string(),
  url: z.string().optional(),
});

server.registerTool(
  "memory.ingestReceipt",
  {
    description:
      "Optional: try POSTing a receipt to a local worker; if unavailable, write locally.",
    inputSchema: MemoryIngestInput,
  },
  async (args: z.infer<typeof MemoryIngestInput>) => {
    const { content, url } = args;
    const res = await memoryIngestReceipt({ repoRoot, content, url });
    return { content: [{ type: "text", text: JSON.stringify(res) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
