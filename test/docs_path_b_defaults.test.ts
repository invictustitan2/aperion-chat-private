import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function readDoc(rel: string) {
  return fs.readFileSync(path.join(repoRoot(), rel), "utf8");
}

describe("Path B docs defaults", () => {
  it("API reference treats /api as the browser contract", () => {
    const doc = readDoc("docs/API_REFERENCE.md");

    expect(doc).toContain("https://chat.aperion.cc/api");
    expect(doc).toContain("https://api.aperion.cc");

    // Drift trap: docs must not instruct prod browser builds to use the cross-origin base.
    expect(doc).not.toMatch(/production browser builds should keep using/i);
    expect(doc).not.toMatch(
      /VITE_API_BASE_URL\s*=\s*https:\/\/api\.aperion\.cc/i,
    );
  });

  it("environment matrix specifies prod web base /api (or unset)", () => {
    const doc = readDoc("docs/environment-matrix.md");

    expect(doc).toMatch(/VITE_API_BASE_URL=\/api/i);
    expect(doc).toMatch(/leave it unset/i);

    // Drift trap: no “current: https://api.aperion.cc” language in prod guidance.
    expect(doc).not.toMatch(/current:\s*`https:\/\/api\.aperion\.cc`/i);
    expect(doc).not.toMatch(/VITE_API_BASE_URL=https:\/\/api\.aperion\.cc/i);
  });
});
