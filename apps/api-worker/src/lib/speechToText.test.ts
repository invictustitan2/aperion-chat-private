import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./googleAuth", () => ({
  getGoogleAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("returns concatenated transcription", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ alternatives: [{ transcript: "hello world" }] }],
        }),
      }),
    );

    const { transcribeAudio } = await import("./speechToText");
    const result = await transcribeAudio("gs://fake");
    expect(result).toBe("hello world");
  });
});
