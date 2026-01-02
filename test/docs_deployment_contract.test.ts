import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function readDoc(rel: string) {
  const filePath = path.join(repoRoot(), rel);
  return fs.readFileSync(filePath, "utf8");
}

describe("DEPLOYMENT.md doc drift guards", () => {
  it("does not instruct production browser builds to use cross-origin api.aperion.cc", () => {
    const doc = readDoc("DEPLOYMENT.md");

    // Allow mentioning api.aperion.cc as back-compat/tooling, but do not allow
    // instructions that set production browser base to https://api.aperion.cc.
    expect(doc).not.toMatch(
      /\bVITE_API_BASE_URL\b\s*\|\s*`?https:\/\/api\.aperion\.cc`?/i,
    );
    expect(doc).not.toMatch(
      /VITE_API_BASE_URL\s*[:=]\s*https:\/\/api\.aperion\.cc/i,
    );
  });

  it("documents the production browser base as /api (or unset)", () => {
    const doc = readDoc("DEPLOYMENT.md");

    expect(doc).toMatch(/VITE_API_BASE_URL[^\n]*`\/api`/i);
    expect(doc).toMatch(/omit\/unset\s+`VITE_API_BASE_URL`/i);
  });
});
