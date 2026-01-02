import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function readWorkflow() {
  const workflowPath = path.join(
    repoRoot(),
    ".github",
    "workflows",
    "deploy-web.yml",
  );
  return fs.readFileSync(workflowPath, "utf8");
}

function normalizeYamlScalar(raw: string) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

describe("deploy-web.yml Path B contract", () => {
  it("does not build prod web with cross-origin api.aperion.cc", () => {
    const yml = readWorkflow();
    expect(yml).not.toMatch(/https:\/\/api\.aperion\.cc\b/);
  });

  it("does not set VITE_API_BASE_URL to an absolute URL", () => {
    const yml = readWorkflow();
    expect(yml).not.toMatch(/VITE_API_BASE_URL:\s*https?:\/\//);
  });

  it("either omits VITE_API_BASE_URL or sets it to /api", () => {
    const yml = readWorkflow();
    const matches = Array.from(
      yml.matchAll(/^\s*VITE_API_BASE_URL:\s*(.+)\s*$/gm),
    );

    for (const match of matches) {
      const value = normalizeYamlScalar(match[1] || "");
      expect(value).toBe("/api");
    }
  });

  it("includes an explicit drift guard step", () => {
    const yml = readWorkflow();
    expect(yml).toContain("Guard Path B API base");
    expect(yml).toContain("Production deploy must not set VITE_API_BASE_URL");
  });
});
