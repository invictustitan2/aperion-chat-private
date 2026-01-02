import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  return {
    DurableObject: class {
      constructor(_state: unknown, _env: unknown) {}
    },
  };
});

vi.mock("../../src/lib/authContext", () => {
  return {
    getAuthContext: vi.fn(async () => ({
      authenticated: false,
      status: 401,
      mode: "token",
      reason: "Unauthorized",
      method: "token",
      principalType: "unknown",
      userId: "",
    })),
    getAuthFingerprintFromAuthContext: vi.fn(() => "fp"),
  };
});

vi.mock("../../src/lib/wsDeny", () => {
  return {
    createPolicyCloseWebSocketUpgradeResponse: vi.fn(
      () => new Response("denied", { status: 403 }),
    ),
  };
});

describe("ChatState Durable Object", () => {
  it("returns 426 when Upgrade header is missing", async () => {
    const { ChatState } = await import("../../src/do/ChatState");
    const state = new ChatState({} as unknown as never, {} as unknown as never);
    const resp = await state.fetch(new Request("http://local.test/v1/ws"));
    expect(resp.status).toBe(426);
  });

  it("denies websocket upgrade when unauthenticated", async () => {
    const { ChatState } = await import("../../src/do/ChatState");
    const { createPolicyCloseWebSocketUpgradeResponse } =
      await import("../../src/lib/wsDeny");

    const state = new ChatState(
      {} as unknown as never,
      {
        APERION_AUTH_LOG_OUTCOMES: "deny",
      } as unknown as never,
    );

    const req = new Request("http://local.test/v1/ws", {
      headers: { Upgrade: "websocket" },
    });
    const resp = await state.fetch(req);
    expect(resp.status).toBe(403);
    expect(
      vi.mocked(createPolicyCloseWebSocketUpgradeResponse),
    ).toHaveBeenCalledWith(
      expect.objectContaining({ closeCode: 1008, closeReason: "Unauthorized" }),
    );
  });

  it("handles ping/typing/message and cleans up sessions", async () => {
    const { ChatState } = await import("../../src/do/ChatState");

    const state = new ChatState({} as unknown as never, {} as unknown as never);
    const stateHarness = state as unknown as {
      handleSession: (socket: unknown, userId: string) => void;
      broadcast: (msg: string) => void;
    };

    const createSocket = () => {
      const listeners: Record<string, Array<(evt: unknown) => void>> = {};
      return {
        accept: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn((type: string, cb: (evt: unknown) => void) => {
          (listeners[type] ||= []).push(cb);
        }),
        __emit(type: string, evt: unknown) {
          for (const cb of listeners[type] || []) cb(evt);
        },
      };
    };

    const socket1 = createSocket();
    const socket2 = createSocket();

    stateHarness.handleSession(socket1, "user-1");
    stateHarness.handleSession(socket2, "user-2");

    socket1.__emit("message", { data: "not-json" });

    socket1.__emit("message", { data: JSON.stringify({ type: "ping" }) });
    const firstSend = vi.mocked(socket1.send).mock.calls[0]?.[0] as string;
    expect(JSON.parse(firstSend)).toEqual(
      expect.objectContaining({ type: "pong" }),
    );

    socket1.__emit("message", { data: JSON.stringify({ type: "typing" }) });
    expect(socket2.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "typing", userId: "user-1" }),
    );

    socket1.__emit("message", { data: JSON.stringify({ type: "message" }) });

    vi.mocked(socket2.send).mockImplementation(() => {
      throw new Error("send failed");
    });
    stateHarness.broadcast("hi");

    vi.mocked(socket2.send).mockClear();
    stateHarness.broadcast("hi again");
    expect(socket2.send).not.toHaveBeenCalled();

    vi.mocked(socket1.send).mockClear();
    socket1.__emit("close", { code: 1000, reason: "", wasClean: true });
    stateHarness.broadcast("after close");
    expect(socket1.send).not.toHaveBeenCalled();

    socket2.__emit("error", {});
    vi.mocked(socket2.send).mockClear();
    stateHarness.broadcast("after error");
    expect(socket2.send).not.toHaveBeenCalled();
  });
});
