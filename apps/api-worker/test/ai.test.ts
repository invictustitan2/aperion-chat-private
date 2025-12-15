import { Ai } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { generateEmbedding } from "../src/lib/ai";

describe("AI Integration", () => {
  let mockAi: Ai;

  beforeEach(() => {
    mockAi = {
      run: vi.fn(),
    } as unknown as Ai;
  });

  it("should generate embedding", async () => {
    // Mock successful response
    (mockAi.run as Mock).mockResolvedValue({
      data: [[0.1, 0.2, 0.3]],
    });

    const embedding = await generateEmbedding(mockAi, "test text");
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", {
      text: ["test text"],
    });
  });

  it("should throw error if response is empty", async () => {
    (mockAi.run as Mock).mockResolvedValue({
      data: [],
    });

    await expect(generateEmbedding(mockAi, "test")).rejects.toThrow(
      "Failed to generate embedding",
    );
  });
});
