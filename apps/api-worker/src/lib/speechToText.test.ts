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

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "bad",
      }),
    );

    const { transcribeAudio } = await import("./speechToText");
    await expect(transcribeAudio("gs://fake")).rejects.toThrow(
      "Speech-to-text failed: 500",
    );
  });

  it("returns word time offsets when enabled", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            alternatives: [
              {
                words: [
                  {
                    word: "hello",
                    startTime: { seconds: "1", nanos: 500_000_000 },
                    endTime: { seconds: 2, nanos: 0 },
                  },
                  {
                    word: undefined,
                    startTime: {},
                    endTime: {},
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchSpy);

    const { transcribeAudio } = await import("./speechToText");
    const res = await transcribeAudio(
      { bytes: new Uint8Array([1, 2, 3]) },
      true,
    );

    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toEqual({ word: "hello", start: 1.5, end: 2 });
    expect(res[1]).toEqual({ word: "", start: 0, end: 0 });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
