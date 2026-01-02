import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeD1Database, createMockEnv } from "../bindings/mockBindings";

vi.mock("../../src/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ai")>();
  return {
    ...actual,
    generateChatCompletion: vi.fn(),
  };
});

vi.mock("../../src/lib/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/tools")>();
  return {
    ...actual,
    executeTool: vi.fn(async () => "tool ok"),
  };
});

describe("ChatService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("processMessage: falls back to identity tone, falls back to keyword memories, executes tool calls, and persists", async () => {
    const db = createFakeD1Database({
      first: async ({ query }) => {
        if (query.includes("FROM preferences")) {
          // Invalid JSON in preferences triggers ChatService try/catch.
          return { key: "ai.tone", value: "friendly", updated_at: 123 };
        }
        if (query.includes("FROM identity")) {
          return { preferred_tone: "friendly" };
        }
        return null;
      },
      all: async ({ query }) => {
        if (query.includes("FROM semantic WHERE")) {
          return {
            success: true,
            meta: {},
            results: [
              {
                id: "sem-1",
                content: "alpha beta gamma memory content",
              },
            ],
          };
        }
        return { success: true, meta: {}, results: [] };
      },
      run: async () => ({ success: true, meta: {}, results: [] }),
    });

    const env = createMockEnv({ MEMORY_DB: db });

    const aiMod = await import("../../src/lib/ai");
    const toolsMod = await import("../../src/lib/tools");
    const { SemanticService } =
      await import("../../src/services/SemanticService");
    const { ChatService } = await import("../../src/services/ChatService");

    // Force semantic path to fail so we cover keyword fallback.
    vi.spyOn(SemanticService.prototype, "hybridSearch").mockRejectedValue(
      new Error("no vectors"),
    );

    const generateChatCompletion = vi.mocked(aiMod.generateChatCompletion);
    generateChatCompletion
      .mockResolvedValueOnce({
        response: "draft",
        tool_calls: [{ name: "noop", arguments: "{}" }],
      } as any)
      .mockResolvedValueOnce({ response: "final" } as any);

    const out = await new ChatService(env).processMessage(
      "alpha beta",
      [],
      "workers-ai",
      "conv-1",
    );

    expect(out.response).toBe("final");
    expect(out.usedMemories).toHaveLength(1);
    expect(out.usedMemories[0]).toMatchObject({
      type: "semantic",
      id: "sem-1",
    });

    expect(vi.mocked(toolsMod.executeTool)).toHaveBeenCalledTimes(1);

    // Ensure persistence insert ran.
    const inserts = db.prepared.filter((p) =>
      p.query.includes("INSERT INTO episodic"),
    );
    expect(inserts.length).toBe(1);
    expect(inserts[0].binds).toContain("conv-1");
  });

  it("processMessage: gemini path rejects missing API key", async () => {
    const env = createMockEnv();
    const { ChatService } = await import("../../src/services/ChatService");

    await expect(
      new ChatService(env).processMessage("hi", [], "gemini"),
    ).rejects.toThrow(/Gemini API Key not configured/);
  });
});
