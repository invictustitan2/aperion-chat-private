import { describe, expect, it, vi } from "vitest";
import {
  transcribeWithTimestamps,
  transcribeWithWhisper,
} from "./workersAiStt";

describe("Workers AI Speech-to-Text", () => {
  it("transcribeWithWhisper returns text from audio", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello, this is a test transcription.",
        vtt: "",
        words: [],
      }),
    };

    const audioBytes = new Uint8Array([0x00, 0x01, 0x02]);
    const result = await transcribeWithWhisper(
      mockAi as unknown as Ai,
      audioBytes,
    );

    expect(mockAi.run).toHaveBeenCalledWith("@cf/openai/whisper", {
      audio: Array.from(audioBytes),
    });
    expect(result).toBe("Hello, this is a test transcription.");
  });

  it("transcribeWithWhisper returns empty string for empty result", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "",
      }),
    };

    const audioBytes = new Uint8Array([0x00]);
    const result = await transcribeWithWhisper(
      mockAi as unknown as Ai,
      audioBytes,
    );

    expect(result).toBe("");
  });

  it("transcribeWithTimestamps returns full result object", async () => {
    const mockResult = {
      text: "Hello world",
      vtt: "WEBVTT...",
      words: [
        { word: "Hello", start: 0, end: 0.5 },
        { word: "world", start: 0.5, end: 1.0 },
      ],
    };

    const mockAi = {
      run: vi.fn().mockResolvedValue(mockResult),
    };

    const audioBytes = new Uint8Array([0x00]);
    const result = await transcribeWithTimestamps(
      mockAi as unknown as Ai,
      audioBytes,
    );

    expect(result).toEqual(mockResult);
    expect(result.words).toHaveLength(2);
    expect(result.words?.[0].word).toBe("Hello");
  });
});
