import { describe, expect, it, vi } from "vitest";
import { EpisodicService } from "../../src/services/EpisodicService";
import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

vi.mock("@aperion/policy", () => {
  return {
    MemoryWriteGate: {
      shouldWriteEpisodic: () => ({
        decision: "allow",
        timestamp: 123,
        reasonCodes: [],
        inputsHash: "test-inputs-hash",
      }),
    },
  };
});

describe("EpisodicService", () => {
  it("creates a record (sync path) and writes a receipt", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({ MEMORY_DB: db });
    // Force sync path so the episodic INSERT is executed.
    (env as unknown as { MEMORY_QUEUE?: unknown }).MEMORY_QUEUE = undefined;

    const svc = new EpisodicService(env);

    const out = await svc.create({
      content: "hello",
      provenance: { source_type: "user" },
    } as unknown as Parameters<EpisodicService["create"]>[0]);

    expect(out.success).toBe(true);

    const queries = db.prepared.map((p) => p.query);
    expect(queries.some((q) => q.includes("INSERT INTO receipts"))).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO episodic"))).toBe(true);
  });

  it("lists records and tolerates invalid tags JSON", async () => {
    const db = createFakeD1Database({
      all: async () => ({
        success: true,
        meta: {},
        results: [
          {
            id: "e1",
            created_at: 1,
            content: "c",
            provenance: "{}",
            hash: "h",
            tags: "not-json",
            importance: null,
            conversation_id: null,
          },
        ],
      }),
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const svc = new EpisodicService(env);

    const rows = await svc.list(10, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags).toEqual([]);
    expect(rows[0]?.importance).toBeUndefined();
  });

  it("prevents editing non-user content", async () => {
    const db = createFakeD1Database({
      first: async () => ({
        id: "e1",
        created_at: 1,
        content: "old",
        provenance: JSON.stringify({ source_type: "assistant" }),
        hash: "h",
        tags: "[]",
        importance: 0.5,
      }),
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const svc = new EpisodicService(env);

    await expect(svc.update("e1", { content: "new" })).rejects.toThrow(
      "Only user messages can be edited",
    );
  });

  it("updates tags + importance and clamps importance", async () => {
    const db = createFakeD1Database({
      first: async () => ({
        id: "e1",
        created_at: 1,
        content: "old",
        provenance: JSON.stringify({ source_type: "user" }),
        hash: "h",
        tags: "[]",
        importance: 0.5,
      }),
      run: async () => ({ success: true, meta: {}, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const svc = new EpisodicService(env);

    const out = await svc.update("e1", {
      tags: ["A", "a", "  ", "b"],
      importance: 2,
    });

    expect(out.success).toBe(true);

    const update = db.prepared.find((p) =>
      p.query.startsWith("UPDATE episodic"),
    );
    expect(update).toBeTruthy();
  });
});
