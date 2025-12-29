# MCP (Model Context Protocol)

This repo includes a minimal, local MCP server so tooling can interact with the repo in a structured way (receipts, search, and redacted status checks).

## Server

Package: `tools/mcp/aperion`

Build:

- `pnpm -C tools/mcp/aperion build`

Run (stdio transport):

- `node tools/mcp/aperion/dist/index.js`

## Tools

- `receipts.append`
  - Appends text or JSONL into `.ref/receipts/` (path is restricted to stay inside that directory).

- `repo.search`
  - Wraps `rg` (ripgrep) to search the repo and return file+line excerpts.

- `secrets.status`
  - Calls `./dev secrets:status` and returns the redacted output.

- `memory.ingestReceipt` (optional)
  - If a local worker is reachable, POSTs a receipt; otherwise stores locally.

## Client configuration (examples)

These are client-agnostic examples showing how to launch the server.

### Stdio

```json
{
  "command": "node",
  "args": ["tools/mcp/aperion/dist/index.js"],
  "cwd": "."
}
```

## Smoke test

- `pnpm -C tools/mcp/aperion smoke`

This starts the server locally and calls `receipts.append`, then verifies the receipt file exists.
