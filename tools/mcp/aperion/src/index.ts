import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { appendReceipt } from "./receipts.js";
import { repoSearch } from "./repoSearch.js";
import { secretsStatus } from "./secretsStatus.js";
import { memoryIngestReceipt } from "./memoryIngest.js";

export type AperionMcpDeps = {
  appendReceipt: typeof appendReceipt;
  repoSearch: typeof repoSearch;
  secretsStatus: typeof secretsStatus;
  memoryIngestReceipt: typeof memoryIngestReceipt;
};

const defaultDeps: AperionMcpDeps = {
  appendReceipt,
  repoSearch,
  secretsStatus,
  memoryIngestReceipt,
};

const ReceiptsAppendInput = z.object({
  relativePath: z.string().optional(),
  content: z.string(),
});

const RepoSearchInput = z.object({
  query: z.string(),
  include: z.string().optional(),
  maxResults: z.number().int().optional(),
});

const MemoryIngestInput = z.object({
  content: z.string(),
  url: z.string().optional(),
});

export function createMcpTools(opts: {
  repoRoot: string;
  deps?: Partial<AperionMcpDeps>;
}) {
  const repoRoot = opts.repoRoot;
  const deps: AperionMcpDeps = { ...defaultDeps, ...(opts.deps ?? {}) };

  return {
    receiptsAppend: {
      inputSchema: ReceiptsAppendInput,
      handler: async (args: z.infer<typeof ReceiptsAppendInput>) => {
        const { relativePath, content } = args;
        const { relativePath: rel } = deps.appendReceipt({
          repoRoot,
          relativePath,
          content,
        });
        return {
          content: [
            { type: "text", text: `ok: appended to .ref/receipts/${rel}` },
          ],
        };
      },
    },
    repoSearch: {
      inputSchema: RepoSearchInput,
      handler: async (args: z.infer<typeof RepoSearchInput>) => {
        const { query, include, maxResults } = args;
        const res = deps.repoSearch({ repoRoot, query, include, maxResults });
        if (!res.ok) {
          return {
            content: [
              {
                type: "text",
                text: `error: ${res.error ?? "search failed"}`,
              },
            ],
          };
        }
        const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
        return { content: [{ type: "text", text: out || "(no matches)" }] };
      },
    },
    secretsStatus: {
      handler: async () => {
        const res = deps.secretsStatus({ repoRoot });
        const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
        return { content: [{ type: "text", text: out }] };
      },
    },
    memoryIngestReceipt: {
      inputSchema: MemoryIngestInput,
      handler: async (args: z.infer<typeof MemoryIngestInput>) => {
        const { content, url } = args;
        const res = await deps.memoryIngestReceipt({ repoRoot, content, url });
        return { content: [{ type: "text", text: JSON.stringify(res) }] };
      },
    },
  };
}

export function createAperionMcpServer(opts: {
  repoRoot: string;
  deps?: Partial<AperionMcpDeps>;
}) {
  const repoRoot = opts.repoRoot;
  const server = new McpServer({ name: "aperion", version: "0.0.0" });

  const tools = createMcpTools({ repoRoot, deps: opts.deps });

  server.registerTool(
    "receipts.append",
    {
      description:
        "Append a receipt into .ref/receipts/ (path restricted to that directory).",
      inputSchema: tools.receiptsAppend.inputSchema,
    },
    tools.receiptsAppend.handler,
  );

  server.registerTool(
    "repo.search",
    {
      description: "Search the repo via ripgrep (rg).",
      inputSchema: tools.repoSearch.inputSchema,
    },
    tools.repoSearch.handler,
  );

  server.registerTool(
    "secrets.status",
    {
      description:
        "Run ./dev secrets:status (output is already redacted by the devshell).",
    },
    tools.secretsStatus.handler,
  );

  server.registerTool(
    "memory.ingestReceipt",
    {
      description:
        "Optional: try POSTing a receipt to a local worker; if unavailable, write locally.",
      inputSchema: tools.memoryIngestReceipt.inputSchema,
    },
    tools.memoryIngestReceipt.handler,
  );

  return server;
}

export async function runAperionMcpServer(opts?: { repoRoot?: string }) {
  const repoRoot =
    opts?.repoRoot ?? process.env.APERION_REPO_ROOT ?? process.cwd();
  const server = createAperionMcpServer({ repoRoot });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isMainEntrypoint() {
  const self = fileURLToPath(import.meta.url);
  const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return argv1 && argv1 === self;
}

if (isMainEntrypoint()) {
  runAperionMcpServer().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
