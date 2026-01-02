import { describe, expect, it, vi } from "vitest";

import {
  analyzeImage,
  generateChatCompletion,
  generateChatCompletionStream,
  generateEmbedding,
} from "./ai";

function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";

  return (async () => {
    for (let done = false; !done; ) {
      const { value, done: readDone } = await reader.read();
      done = readDone;
      if (done) break;
      out += decoder.decode(value);
    }
    return out;
  })();
}

describe("ai.ts branch coverage", () => {
  it("generateEmbedding throws when response is missing data", async () => {
    const ai = { run: vi.fn(async () => ({ data: [] })) } as unknown as Ai;
    await expect(generateEmbedding(ai, "x")).rejects.toThrow(
      /Failed to generate embedding/,
    );
  });

  it("generateChatCompletion attaches tools when provided and throws on empty result", async () => {
    const ai = { run: vi.fn(async () => ({})) } as unknown as Ai;
    await expect(
      generateChatCompletion(
        ai,
        [{ role: "user", content: "hi" }],
        "sys",
        "chat",
        [
          {
            name: "t",
            description: "d",
            parameters: { type: "object", properties: {} },
          },
        ],
      ),
    ).rejects.toThrow(/Failed to generate chat completion/);

    const callArgs = vi.mocked(ai.run).mock.calls[0] ?? [];
    const opts = callArgs[1] as unknown;
    expect(opts && typeof opts === "object" && "tools" in opts).toBe(true);
  });

  it("generateChatCompletionStream formats JSON, raw, and DONE lines as SSE", async () => {
    const encoder = new TextEncoder();

    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"response":"hi"}\n'));
        controller.enqueue(encoder.encode('data: {"response":"there"}\n'));
        controller.enqueue(encoder.encode("data: not-json\n"));
        controller.enqueue(encoder.encode("data: [DONE]\n"));
        controller.close();
      },
    });

    const ai = { run: vi.fn(async () => upstream) } as unknown as Ai;
    const stream = await generateChatCompletionStream(
      ai,
      [{ role: "user", content: "hi" }],
      undefined,
      "chat",
    );

    const text = await readAll(stream);
    expect(text).toContain('data: {"token":"hi"}');
    expect(text).toContain('data: {"token":"there"}');
    expect(text).toContain('data: {"token":"not-json"}');
    expect(text).toContain("data: [DONE]");
  });

  it("analyzeImage uses default prompt and throws when response missing fields", async () => {
    // Polyfill atob/btoa for node test env.
    const g = globalThis as unknown as {
      atob?: (s: string) => string;
      btoa?: (s: string) => string;
    };

    g.atob ??= (s: string) => Buffer.from(s, "base64").toString("binary");
    g.btoa ??= (s: string) => Buffer.from(s, "binary").toString("base64");

    const aiOk = {
      run: vi.fn(async () => ({ description: "desc" })),
    } as unknown as Ai;

    const out = await analyzeImage(aiOk, new Uint8Array([1, 2, 3]));
    expect(out).toBe("desc");

    const aiBad = { run: vi.fn(async () => ({})) } as unknown as Ai;
    await expect(analyzeImage(aiBad, "AQI=")).rejects.toThrow(
      /Failed to analyze image/,
    );
  });
});
