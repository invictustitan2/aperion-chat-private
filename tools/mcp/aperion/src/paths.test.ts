import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveWithin } from "./paths.js";

describe("resolveWithin", () => {
  it("allows paths inside base", () => {
    const base = "/tmp/base";
    const resolved = resolveWithin(base, "a/b.txt");
    expect(resolved).toBe(path.resolve(base, "a/b.txt"));
  });

  it("rejects path traversal", () => {
    const base = "/tmp/base";
    expect(() => resolveWithin(base, "../escape.txt")).toThrow(/escapes/);
  });
});
