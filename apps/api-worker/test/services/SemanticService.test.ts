import { describe, expect, it, vi } from "vitest";
import { SemanticService } from "../../src/services/SemanticService";
import {
  createFakeAi,
  createFakeD1Database,
  createFakeVectorizeIndex,
  createMockEnv,
} from "../bindings/mockBindings";

vi.mock("@aperion/policy", () => {
  return {
    MemoryWriteGate: {
      shouldWriteSemantic: () => ({
        decision: "allow",
        timestamp: 123,
        reasonCodes: [],
        inputsHash: "test-inputs-hash",
      }),
    },
  };
});

describe("SemanticService", () => {
  it("creates a semantic record (sync path) and inserts into vector store", async () => {
    const vectors = createFakeVectorizeIndex();

    const db = createFakeD1Database({
      run: async () => ({ success: true, meta: {}, results: [] }),
    });

    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.11, 0.22] }),
      MEMORY_VECTORS: vectors,
    });

    (env as unknown as { MEMORY_QUEUE?: unknown }).MEMORY_QUEUE = undefined;

    const svc = new SemanticService(env);

    const out = await svc.create({
      content: "hello world",
      references: ["r1"],
      provenance: { source_type: "user" },
    } as unknown as Parameters<SemanticService["create"]>[0]);

    expect(out.success).toBe(true);

    const queries = db.prepared.map((p) => p.query);
    expect(queries.some((q) => q.includes("INSERT INTO receipts"))).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO semantic"))).toBe(true);

    // Vector insert should have been called at least once.
    expect(vectors.inserted.length).toBeGreaterThan(0);
  });

  it("creates a semantic record via queue when MEMORY_QUEUE is present", async () => {
    const vectors = createFakeVectorizeIndex();
    const db = createFakeD1Database({
      run: async () => ({ success: true, meta: {}, results: [] }),
    });

    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.11, 0.22] }),
      MEMORY_VECTORS: vectors,
      MEMORY_QUEUE: { send },
    });

    const svc = new SemanticService(env);
    const out = await svc.create({
      content: "hello world",
      references: ["r1"],
      provenance: { source_type: "user" },
    } as unknown as Parameters<SemanticService["create"]>[0]);

    expect(out.status).toBe("queued");
    expect(send).toHaveBeenCalledTimes(1);
    expect(vectors.inserted.length).toBe(0);
  });

  it("hybridSearch merges keyword + semantic scores", async () => {
    const vectors = createFakeVectorizeIndex({
      fixedQueryMatches: [{ id: "s1", score: 0.9 }],
    });

    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (query.includes("WHERE LOWER(content) LIKE")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "s1",
                content: "alpha beta gamma",
                created_at: 1,
                provenance: "{}",
                references: "[]",
              },
            ],
          };
        }

        if (query.includes("WHERE id IN")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "s1",
                content: "alpha beta gamma",
                created_at: 1,
                provenance: "{}",
                references: "[]",
              },
            ],
          };
        }

        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.01, 0.02] }),
      MEMORY_VECTORS: vectors,
    });

    const svc = new SemanticService(env);

    const out = await svc.hybridSearch("alpha beta", 10);

    expect(out.length).toBeGreaterThan(0);
    expect(out[0]?.id).toBe("s1");
    expect(out[0]?.score).toBeGreaterThan(0);
  });

  it("hybridSearch returns keyword-only results when semantic is unavailable", async () => {
    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (query.includes("WHERE LOWER(content) LIKE")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "k1",
                content: "alpha beta gamma",
                created_at: 1,
                provenance: "{}",
                references: "[]",
              },
            ],
          };
        }
        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({
      MEMORY_DB: db,
      // no AI / no MEMORY_VECTORS -> semantic section skipped
    });

    const svc = new SemanticService(env);
    const out = await svc.hybridSearch("alpha beta", 10);
    expect(out.map((r) => r.id)).toContain("k1");
  });

  it("hybridSearch falls back to semantic-only when keyword query fails", async () => {
    const vectors = createFakeVectorizeIndex({
      fixedQueryMatches: [{ id: "s1", score: 0.9 }],
    });

    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (query.includes("WHERE LOWER(content) LIKE")) {
          throw new Error("db down");
        }
        if (query.includes("WHERE id IN")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "s1",
                content: "alpha beta gamma",
                created_at: 1,
                provenance: "{}",
                references: "[]",
              },
            ],
          };
        }
        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.01, 0.02] }),
      MEMORY_VECTORS: vectors,
    });

    const svc = new SemanticService(env);
    const out = await svc.hybridSearch("alpha beta", 10);
    expect(out[0]?.id).toBe("s1");
  });

  it("hybridSearch falls back to keyword-only when semantic query fails", async () => {
    const vectors = createFakeVectorizeIndex({
      fixedQueryMatches: [{ id: "s1", score: 0.9 }],
    });
    // Force vectorStore.query to throw.
    vi.spyOn(vectors, "query").mockRejectedValue(new Error("vector down"));

    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (query.includes("WHERE LOWER(content) LIKE")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "k1",
                content: "alpha beta gamma",
                created_at: 1,
                provenance: "{}",
                references: "[]",
              },
            ],
          };
        }
        if (query.includes("WHERE id IN")) {
          return { success: true, meta: {}, results: [] };
        }
        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.01, 0.02] }),
      MEMORY_VECTORS: vectors,
    });

    const svc = new SemanticService(env);
    const out = await svc.hybridSearch("alpha beta", 10);
    expect(out.map((r) => r.id)).toContain("k1");
  });

  it("summarize runs synchronously when the queue is absent", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ chatResponse: "summary text" }),
    });

    (env as unknown as { MEMORY_QUEUE?: unknown }).MEMORY_QUEUE = undefined;

    const svc = new SemanticService(env);

    const out = await svc.summarize(["a", "b"], "q");
    expect(out.summary).toBe("summary text");
  });

  it("search returns [] in explicit test env when vectors are missing", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({ MEMORY_DB: db, AI: createFakeAi() }) as any;
    // isTestEnv(env) reads NODE_ENV/ENVIRONMENT/APERION_ENV from the env object.
    env.NODE_ENV = "test";
    env.MEMORY_VECTORS = undefined;

    const svc = new SemanticService(env);
    const out = await svc.search("x", 5);
    expect(out).toEqual([]);
  });

  it("search throws when AI is missing", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({
      MEMORY_DB: db,
      MEMORY_VECTORS: createFakeVectorizeIndex(),
    }) as any;
    // createMockEnv() uses a default AI binding when undefined; explicitly remove it.
    delete env.AI;
    env.AI = undefined;
    const svc = new SemanticService(env);
    await expect(svc.search("x", 5)).rejects.toThrow("AI not configured");
  });

  it("search throws when vectors are missing in non-test env", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({ MEMORY_DB: db, AI: createFakeAi() }) as any;
    env.NODE_ENV = "production";
    env.MEMORY_VECTORS = undefined;

    const svc = new SemanticService(env);
    await expect(svc.search("x", 5)).rejects.toThrow(
      "Vectorize not configured",
    );
  });

  it("search returns [] when vector query has no matches", async () => {
    const vectors = createFakeVectorizeIndex({ fixedQueryMatches: [] });
    const db = createFakeD1Database();
    const env = createMockEnv({
      MEMORY_DB: db,
      AI: createFakeAi({ embedding: [0.01, 0.02] }),
      MEMORY_VECTORS: vectors,
    });

    const svc = new SemanticService(env);
    const out = await svc.search("x", 5);
    expect(out).toEqual([]);
  });
});
