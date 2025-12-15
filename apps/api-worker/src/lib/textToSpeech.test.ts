import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./googleAuth", () => ({
  getGoogleAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("returns audio buffer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          audioContent: Buffer.from("abc").toString("base64"),
        }),
      }),
    );

    const { synthesizeSpeech } = await import("./textToSpeech");
    const buf = await synthesizeSpeech("hello");
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
