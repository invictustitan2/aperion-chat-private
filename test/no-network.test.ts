import { describe, expect, it } from "vitest";

// This test makes the "no network" guardrail real.
// It should fail loudly if any test tries to hit external endpoints.

describe("no-network guardrail", () => {
  it("blocks outbound fetch", async () => {
    if (typeof fetch !== "function") return;

    await expect(fetch("https://example.com")).rejects.toThrow(
      /Blocked outbound fetch in tests/i,
    );
  });
});
