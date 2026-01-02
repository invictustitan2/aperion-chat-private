import { describe, it, expect } from "vitest";
import { ConversationsService } from "../../src/services/ConversationsService";
import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

describe("ConversationsService", () => {
  it("list parses optional metadata", async () => {
    const db = createFakeD1Database({
      all: async () =>
        ({
          success: true,
          meta: {},
          results: [
            {
              id: "c1",
              title: "T",
              created_at: 1,
              updated_at: 2,
              metadata: null,
            },
            {
              id: "c2",
              title: "T2",
              created_at: 1,
              updated_at: 2,
              metadata: '{"a":1}',
            },
          ],
        }) as any,
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new ConversationsService(env);

    const out = await svc.list(10, 0);
    expect(out).toHaveLength(2);
    expect(out[0].metadata).toBeUndefined();
    expect(out[1].metadata).toEqual({ a: 1 });
  });

  it("rename validates inputs and errors when record not found", async () => {
    const db = createFakeD1Database({
      run: async () => ({ success: true, meta: { changes: 0 }, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new ConversationsService(env);

    await expect(svc.rename("", "x")).rejects.toThrow("Missing id");
    await expect(svc.rename("c1", "   ")).rejects.toThrow("Missing title");
    await expect(svc.rename("c1", "Ok")).rejects.toThrow("Not found");
  });

  it("delete validates id and errors when record not found", async () => {
    let call = 0;
    const db = createFakeD1Database({
      run: async () => {
        call++;
        // second run is DELETE conversations, force changes=0
        if (call === 2) {
          return { success: true, meta: { changes: 0 }, results: [] } as any;
        }
        return { success: true, meta: { changes: 1 }, results: [] } as any;
      },
    });

    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new ConversationsService(env);

    await expect(svc.delete("")).rejects.toThrow("Missing id");
    await expect(svc.delete("c1")).rejects.toThrow("Not found");
  });

  it("touch is a no-op when id is missing", async () => {
    const db = createFakeD1Database();
    const env = createMockEnv({ MEMORY_DB: db as any });
    const svc = new ConversationsService(env);

    await expect(svc.touch("")).resolves.toBeUndefined();
    expect(db.prepared.length).toBe(0);
  });
});
