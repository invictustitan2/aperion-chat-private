import { describe, expect, it, vi } from "vitest";
import { getVectorStore } from "./vectorStore";

describe("vectorStore", () => {
  it("in test mode, Vectorize calls never occur", async () => {
    const insert = vi.fn(() => {
      throw new Error("Vectorize insert should not be called in test mode");
    });
    const query = vi.fn(() => {
      throw new Error("Vectorize query should not be called in test mode");
    });

    const env = {
      APERION_ENV: "test",
      MEMORY_VECTORS: { insert, query },
    };

    const store = getVectorStore(env);

    await store.insert([{ id: "rec-1", values: [0.1, 0.2, 0.3] }]);
    const result = await store.query([0.1, 0.2, 0.3], {
      topK: 1,
      returnMetadata: true,
    });

    expect(result.matches).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
