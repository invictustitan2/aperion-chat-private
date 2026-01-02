import { describe, it, expect, vi } from "vitest";
import { KnowledgeService } from "../../src/services/KnowledgeService";
import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

function fixedNow() {
  return 1735819200000; // 2025-01-02T00:00:00Z-ish; stable for tests
}

describe("KnowledgeService", () => {
  it("list clamps limit, supports q filter, and parses tags/metadata safely", async () => {
    const db = createFakeD1Database({
      all: async (entry) => {
        expect(entry.query).toContain("FROM knowledge");
        // since, like, like, limit
        expect(entry.binds.length).toBe(4);
        return {
          success: true,
          meta: {},
          results: [
            {
              id: "k1",
              created_at: 1,
              updated_at: 2,
              title: "T",
              content: "C",
              source_semantic_id: null,
              tags: '["a", 123, "b"]',
              metadata: "{not-json}",
            },
          ],
        } as any;
      },
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new KnowledgeService(env);

    const out = await svc.list(9999, 0, "  Hello ");
    expect(out).toHaveLength(1);
    expect(out[0].tags).toEqual(["a", "b"]);
    expect(out[0].metadata).toBeUndefined();
  });

  it("promoteFromSemantic rejects missing semanticId", async () => {
    const env = createMockEnv({ MEMORY_DB: createFakeD1Database() as any });
    const svc = new KnowledgeService(env);

    await expect(svc.promoteFromSemantic("" as any)).rejects.toThrow(
      "Missing semanticId",
    );
  });

  it("promoteFromSemantic errors when semantic record is missing", async () => {
    const db = createFakeD1Database({
      first: async (entry) => {
        if (entry.query.includes("FROM semantic")) return null;
        return null;
      },
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new KnowledgeService(env);

    await expect(svc.promoteFromSemantic("sem-1")).rejects.toThrow(
      "Semantic record not found",
    );
  });

  it("promoteFromSemantic updates existing knowledge record", async () => {
    vi.spyOn(Date, "now").mockReturnValue(fixedNow());

    const db = createFakeD1Database({
      first: async (entry) => {
        if (entry.query.includes("FROM semantic")) {
          return {
            id: "sem-1",
            created_at: 10,
            content: "Hello world",
            tags: '["t1"]',
          };
        }
        if (entry.query.includes("FROM knowledge WHERE source_semantic_id")) {
          return {
            id: "k-existing",
            created_at: 1,
            updated_at: 2,
            title: "Old",
            content: "Old",
            source_semantic_id: "sem-1",
            tags: "[]",
            metadata: '{"x":1}',
          };
        }
        return null;
      },
      run: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new KnowledgeService(env);

    const out = await svc.promoteFromSemantic("sem-1");
    expect(out.id).toBe("k-existing");
    expect(out.sourceSemanticId).toBe("sem-1");
    expect(out.updatedAt).toBe(fixedNow());
    expect(out.title).toContain("Hello world");

    // update query should be prepared
    expect(db.prepared.some((p) => p.query.includes("UPDATE knowledge"))).toBe(
      true,
    );
  });

  it("promoteFromSemantic inserts new knowledge record when none exists", async () => {
    vi.spyOn(Date, "now").mockReturnValue(fixedNow());

    const db = createFakeD1Database({
      first: async (entry) => {
        if (entry.query.includes("FROM semantic")) {
          return {
            id: "sem-2",
            created_at: 10,
            content: " ",
            tags: "not-json",
          };
        }
        if (entry.query.includes("FROM knowledge WHERE source_semantic_id")) {
          return null;
        }
        return null;
      },
      run: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new KnowledgeService(env);

    const out = await svc.promoteFromSemantic("sem-2");
    expect(out.sourceSemanticId).toBe("sem-2");
    expect(out.title).toBe("Untitled");
    expect(out.tags).toEqual([]);

    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO knowledge")),
    ).toBe(true);
  });
});
