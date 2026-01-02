import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

describe("RelationshipsService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("listForNode maps rows and safely parses evidence", async () => {
    const db = createFakeD1Database({
      all: async ({ query }) => {
        if (query.includes("FROM relationships")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "rel-1",
                created_at: 111,
                created_by: "user",
                type: "EVIDENCE_FOR",
                from_kind: "episodic",
                from_id: "e-1",
                to_kind: "semantic",
                to_id: "s-1",
                rationale: "because",
                confidence: null,
                evidence: "not-json",
                from_content: "from",
                to_content: null,
              },
            ],
          };
        }
        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const { RelationshipsService } =
      await import("../../src/services/RelationshipsService");

    const rows = await new RelationshipsService(env).listForNode({
      kind: "episodic",
      id: "e-1",
      limit: 10,
      since: 0,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "rel-1",
      createdAt: 111,
      createdBy: "user",
      type: "EVIDENCE_FOR",
      fromKind: "episodic",
      fromId: "e-1",
      toKind: "semantic",
      toId: "s-1",
      rationale: "because",
      confidence: null,
      evidence: [],
      fromContent: "from",
      toContent: null,
    });
  });

  it("create validates ids and rationale and rejects self-relationships", async () => {
    const env = createMockEnv();
    const { RelationshipsService } =
      await import("../../src/services/RelationshipsService");
    const svc = new RelationshipsService(env);

    await expect(
      svc.create({
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "",
        toKind: "semantic",
        toId: "s-1",
        rationale: "x",
      }),
    ).rejects.toThrow(/Missing fromId/);

    await expect(
      svc.create({
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "e-1",
        toKind: "semantic",
        toId: " ",
        rationale: "x",
      }),
    ).rejects.toThrow(/Missing toId/);

    await expect(
      svc.create({
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "e-1",
        toKind: "semantic",
        toId: "s-1",
        rationale: " ",
      }),
    ).rejects.toThrow(/Missing rationale/);

    await expect(
      svc.create({
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "e-1",
        toKind: "episodic",
        toId: "e-1",
        rationale: "x",
      }),
    ).rejects.toThrow(/Self-relationships are not allowed/);
  });

  it("create clamps confidence, truncates evidence, and returns resolved row when available", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("rel-1");

    const db = createFakeD1Database({
      first: async ({ query }) => {
        if (query.includes("FROM episodic")) return { id: "e-1" };
        if (query.includes("FROM semantic")) return { id: "s-1" };
        return null;
      },
      all: async ({ query }) => {
        if (query.includes("FROM relationships")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "rel-1",
                created_at: 1000,
                created_by: "system",
                type: "INTERPRETS",
                from_kind: "episodic",
                from_id: "e-1",
                to_kind: "semantic",
                to_id: "s-1",
                rationale: "why",
                confidence: 1,
                evidence: '["a"]',
                from_content: "from",
                to_content: "to",
              },
            ],
          };
        }
        return { success: true, meta: {}, results: [] };
      },
      run: async () => ({ success: true, meta: {}, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const { RelationshipsService } =
      await import("../../src/services/RelationshipsService");

    const longEvidence = Array.from({ length: 60 }, (_, i) => i);
    const out = await new RelationshipsService(env).create({
      type: "INTERPRETS",
      fromKind: "episodic",
      fromId: " e-1 ",
      toKind: "semantic",
      toId: " s-1 ",
      rationale: " why ",
      createdBy: "system",
      confidence: 2,
      evidence: longEvidence as unknown as string[],
    });

    expect(out).toMatchObject({
      id: "rel-1",
      createdAt: 1000,
      createdBy: "system",
      type: "INTERPRETS",
      fromKind: "episodic",
      fromId: "e-1",
      toKind: "semantic",
      toId: "s-1",
      rationale: "why",
      confidence: 1,
      evidence: ["a"],
      fromContent: "from",
      toContent: "to",
    });

    const insert = db.prepared.find((p) =>
      p.query.includes("INSERT INTO relationships"),
    );
    expect(insert).toBeTruthy();

    const evidenceBind = (insert!.binds[10] ?? null) as unknown;
    expect(typeof evidenceBind).toBe("string");
    const evidenceParsed = JSON.parse(String(evidenceBind)) as string[];
    expect(evidenceParsed).toHaveLength(50);
    expect(evidenceParsed[0]).toBe("0");
    expect(evidenceParsed[49]).toBe("49");

    const confidenceBind = insert!.binds[9] as unknown;
    expect(confidenceBind).toBe(1);
  });

  it("create maps unique/constraint errors to a friendly message", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("rel-2");

    const db = createFakeD1Database({
      first: async ({ query }) => {
        if (query.includes("FROM episodic")) return { id: "e-1" };
        if (query.includes("FROM semantic")) return { id: "s-1" };
        return null;
      },
      run: async ({ query }) => {
        if (query.includes("INSERT INTO relationships")) {
          throw new Error("UNIQUE constraint failed: relationships.id");
        }
        return { success: true, meta: {}, results: [] };
      },
    });

    const env = createMockEnv({ MEMORY_DB: db });
    const { RelationshipsService } =
      await import("../../src/services/RelationshipsService");

    await expect(
      new RelationshipsService(env).create({
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "e-1",
        toKind: "semantic",
        toId: "s-1",
        rationale: "x",
      }),
    ).rejects.toThrow(/Relationship already exists/);
  });
});
