import { describe, it, expect, vi, beforeEach } from "vitest";

describe("generateAssistantReply", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("returns the first candidate text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello from Gemini" }],
              },
            },
          ],
        }),
      }),
    );

    const { generateAssistantReply } = await import("./gemini");
    const out = await generateAssistantReply("hi", { GEMINI_API_KEY: "x" });
    expect(out).toBe("Hello from Gemini");
  });
});
