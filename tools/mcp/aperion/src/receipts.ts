import fs from "node:fs";
import path from "node:path";
import { resolveWithin } from "./paths.js";

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function receiptsRoot(repoRoot: string) {
  return path.join(repoRoot, ".ref", "receipts");
}

export function defaultReceiptPath() {
  return path.join("mcp", utcDay(), `${utcStamp()}.txt`);
}

export function appendReceipt(opts: {
  repoRoot: string;
  relativePath?: string;
  content: string;
}) {
  const root = receiptsRoot(opts.repoRoot);
  const rel =
    opts.relativePath && opts.relativePath.trim().length > 0
      ? opts.relativePath
      : defaultReceiptPath();
  const abs = resolveWithin(root, rel);

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.appendFileSync(abs, opts.content);

  return { root, relativePath: rel, absolutePath: abs };
}
