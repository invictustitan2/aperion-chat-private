import { describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "../../src/services/AnalyticsService";
import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

describe("AnalyticsService", () => {
  it("builds a dashboard response and fills missing days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));

    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (
          query.includes("FROM episodic WHERE created_at >= ? GROUP BY day")
        ) {
          return {
            success: true,
            meta: {},
            results: [
              { day: "2026-01-01", cnt: 2 },
              { day: "2026-01-02", cnt: 1 },
            ],
          };
        }
        if (
          query.includes("FROM semantic WHERE created_at >= ? GROUP BY day")
        ) {
          return {
            success: true,
            meta: {},
            results: [{ day: "2026-01-01", cnt: 3 }],
          };
        }
        if (
          query.includes(
            "json_extract(provenance, '$.source_type') = 'user'",
          ) &&
          query.includes("GROUP BY day")
        ) {
          return {
            success: true,
            meta: {},
            results: [{ day: "2026-01-02", cnt: 4 }],
          };
        }
        if (
          query.includes(
            "json_extract(provenance, '$.source_type') = 'assistant'",
          ) &&
          query.includes("GROUP BY day")
        ) {
          return {
            success: true,
            meta: {},
            results: [{ day: "2026-01-01", cnt: 5 }],
          };
        }
        if (query.includes("SELECT content FROM semantic")) {
          return {
            success: true,
            meta: {},
            results: [
              { content: "The fox and the dog" },
              { content: "Fox jumps into memory" },
              { content: "Using semantic search for analytics" },
            ],
          };
        }

        return { success: true, meta: {}, results: [] };
      },
      first: async ({ query }) => {
        if (query.includes("AVG(LENGTH(content))")) {
          return { cnt: 10, avg_len: 42.3 };
        }
        if (query.includes("FROM episodic") && query.includes("COUNT(*)")) {
          return { cnt: 7 };
        }
        if (query.includes("FROM semantic") && query.includes("COUNT(*)")) {
          return { cnt: 11 };
        }
        return { cnt: 0 };
      },
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const svc = new AnalyticsService(env);

    const res = await svc.dashboard(3); // clamped to min 7 days

    expect(res.generatedAt).toBeTypeOf("number");
    expect(res.days.length).toBe(7);
    expect(res.days[0]?.date).toBe("2025-12-27");
    expect(res.days[6]?.date).toBe("2026-01-02");

    expect(res.summary.map((s) => s.range)).toEqual(["24h", "7d", "30d"]);
    expect(res.aiUsage.assistantMessages30d).toBe(10);

    // Stopwords should be filtered; "fox" should survive.
    expect(res.topics.some((t) => t.term === "fox" && t.count >= 1)).toBe(true);

    vi.useRealTimers();
  });
});
