import { describe, expect, it } from "vitest";

import { canonicalize, computeHash, hashRunbookTask } from "../src/hash";

describe("packages/shared hash utilities", () => {
  it("canonicalize sorts keys and omits undefined", () => {
    const out = canonicalize({ b: 2, a: 1, z: undefined });
    expect(out).toBe('{"a":1,"b":2}');
  });

  it("computeHash is stable for objects with different key order", () => {
    const h1 = computeHash({ b: 2, a: 1 });
    const h2 = computeHash({ a: 1, b: 2 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashRunbookTask normalizes whitespace", () => {
    const h1 = hashRunbookTask("  hello\nworld\n");
    const h2 = hashRunbookTask("hello   world");
    expect(h1).toBe(h2);
  });
});
