import { describe, expect, it } from "vitest";
import { createPolicyCloseWebSocketUpgradeResponse } from "../../src/lib/wsDeny";

declare global {
  // Minimal runtime polyfill used only for this unit test.
  // eslint-disable-next-line no-var
  var WebSocketPair: new () => { 0: unknown; 1: unknown };
}

describe("createPolicyCloseWebSocketUpgradeResponse", () => {
  it("closes upgrades with the requested close code (canary)", () => {
    const last = {
      server: null as null | {
        accepted: boolean;
        closed?: { code: number; reason: string };
      },
    };

    class FakeSocket {
      accepted = false;
      closed: { code: number; reason: string } | undefined;
      accept() {
        this.accepted = true;
      }
      close(code: number, reason: string) {
        this.closed = { code, reason };
      }
    }

    globalThis.WebSocketPair = class WebSocketPairPolyfill {
      0: FakeSocket;
      1: FakeSocket;
      constructor() {
        this[0] = new FakeSocket();
        this[1] = new FakeSocket();
        last.server = this[1];
      }
    };

    const resp = createPolicyCloseWebSocketUpgradeResponse({
      closeCode: 1008,
      closeReason: "Unauthorized",
    });

    // In Workers runtime this is a 101 upgrade. In Node (undici), 101 is rejected
    // so the helper falls back to 200 to keep this unit test runnable.
    expect([101, 200]).toContain(resp.status);
    expect(last.server?.accepted).toBe(true);
    expect(last.server?.closed).toEqual({ code: 1008, reason: "Unauthorized" });
  });
});
