import { describe, it, expect, vi } from "vitest";
import { IdentityService } from "../../src/services/IdentityService";
import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";
import { MemoryWriteGate } from "@aperion/policy";

describe("IdentityService", () => {
  it("rejects missing required fields", async () => {
    const env = createMockEnv({ MEMORY_DB: createFakeD1Database() as any });
    const svc = new IdentityService(env);

    await expect(svc.upsert({} as any)).rejects.toThrow(
      "Missing key, value, or provenance",
    );
  });

  it("writes a receipt and rejects when policy denies", async () => {
    const shouldWriteSpy = vi
      .spyOn(MemoryWriteGate, "shouldWriteIdentity")
      .mockReturnValue({
        decision: "deny",
        reasonCodes: ["needs_confirmation"],
        timestamp: 123,
        inputsHash: "h",
      } as any);

    const db = createFakeD1Database({
      run: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new IdentityService(env);

    await expect(
      svc.upsert({
        key: "k",
        value: { v: 1 },
        provenance: { source_type: "test", source_id: "t" } as any,
      }),
    ).rejects.toThrow("Policy denied");

    // receipt insert happened
    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO receipts")),
    ).toBe(true);

    shouldWriteSpy.mockRestore();
  });

  it("upserts identity when policy allows", async () => {
    const shouldWriteSpy = vi
      .spyOn(MemoryWriteGate, "shouldWriteIdentity")
      .mockReturnValue({
        decision: "allow",
        reasonCodes: ["ok"],
        timestamp: 456,
        inputsHash: "h2",
      } as any);

    const db = createFakeD1Database({
      run: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
      all: async () => ({ success: true, meta: {}, results: [] }) as any,
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new IdentityService(env);

    const out = await svc.upsert({
      key: "k",
      value: { v: 1 },
      provenance: { source_type: "test", source_id: "t" } as any,
      explicit_confirm: true,
      preferred_tone: "friendly",
      memory_retention_days: 30,
      interface_theme: "dark",
    });

    expect(out.success).toBe(true);
    expect(typeof out.id).toBe("string");
    expect(out.receipt.decision).toBe("allow");

    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO identity")),
    ).toBe(true);

    shouldWriteSpy.mockRestore();
  });
});
