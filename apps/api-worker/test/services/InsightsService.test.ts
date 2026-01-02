import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/SemanticService", () => {
  return {
    SemanticService: vi.fn().mockImplementation(() => ({
      hybridSearch: vi.fn(async () => []),
      summarize: vi.fn(async () => ({
        ok: true,
        summary: "ok",
      })),
    })),
  };
});

import { SemanticService } from "../../src/services/SemanticService";
import { InsightsService } from "../../src/services/InsightsService";

function makeEnv(dbResultsBySql: Record<string, unknown[] | undefined>) {
  return {
    MEMORY_DB: {
      prepare: (sql: string) => ({
        bind: (_limit: number) => ({
          all: async () => ({ results: dbResultsBySql[sql] }),
        }),
      }),
    },
  } as any;
}

describe("InsightsService.generateSummary", () => {
  it("uses hybridSearch when query present", async () => {
    const env = makeEnv({});

    const semanticInstance = {
      hybridSearch: vi.fn(async () => [
        { id: "s1", content: "c1", score: 0.9 },
        { id: "s2", content: "c2", score: 0.1 },
      ]),
      summarize: vi.fn(async (contents: string[], query?: string) => ({
        ok: true,
        summary: `${query}:${contents.join(",")}`,
      })),
    };

    vi.mocked(SemanticService).mockImplementation(
      () => semanticInstance as any,
    );

    const svc = new InsightsService(env);
    const res = await svc.generateSummary({ query: "  hello ", limit: 1000 });

    expect(semanticInstance.hybridSearch).toHaveBeenCalledWith("hello", 20);
    expect(semanticInstance.summarize).toHaveBeenCalledWith(
      ["c1", "c2"],
      "hello",
    );
    expect(res.sources.length).toBe(2);
    expect(res.sources[0]).toMatchObject({ type: "semantic", id: "s1" });
  });

  it("falls back to semantic DB when hybridSearch throws", async () => {
    const env = makeEnv({
      "SELECT id, content FROM semantic ORDER BY created_at DESC LIMIT ?": [
        { id: "db1", content: "fromdb" },
      ],
    });

    const semanticInstance = {
      hybridSearch: vi.fn(async () => {
        throw new Error("boom");
      }),
      summarize: vi.fn(async () => ({ ok: true, summary: "ok" })),
    };

    vi.mocked(SemanticService).mockImplementation(
      () => semanticInstance as any,
    );

    const svc = new InsightsService(env);
    const res = await svc.generateSummary({ query: "q", limit: 2 });

    expect(res.sources).toEqual([{ type: "semantic", id: "db1" }]);
    expect(semanticInstance.summarize).toHaveBeenCalledWith(["fromdb"], "q");
  });

  it("falls back to episodic DB when semantic DB empty", async () => {
    const env = makeEnv({
      "SELECT id, content FROM semantic ORDER BY created_at DESC LIMIT ?": [],
      "SELECT id, content FROM episodic ORDER BY created_at DESC LIMIT ?": [
        { id: "e1", content: "econtent" },
      ],
    });

    const semanticInstance = {
      hybridSearch: vi.fn(async () => []),
      summarize: vi.fn(async () => ({ ok: true, summary: "ok" })),
    };

    vi.mocked(SemanticService).mockImplementation(
      () => semanticInstance as any,
    );

    const svc = new InsightsService(env);
    const res = await svc.generateSummary({ limit: 0 });

    expect(res.sources).toEqual([{ type: "episodic", id: "e1" }]);
    expect(semanticInstance.summarize).toHaveBeenCalledWith(
      ["econtent"],
      undefined,
    );
  });
});
