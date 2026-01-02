import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WebSocketClient,
  initializeWebSocket,
  getWebSocketClient,
  getWebSocketTelemetry,
} from "./websocket";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: null | (() => void) = null;
  onmessage: null | ((evt: { data: string }) => void) = null;
  onclose:
    | null
    | ((evt: { code: number; reason: string; wasClean: boolean }) => void) =
    null;
  onerror: null | (() => void) = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }

  _open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  _message(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

describe("WebSocketClient", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("connects, sends messages, and reconnects on unexpected close", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onMessage = vi.fn();

    const client = new WebSocketClient({
      url: "ws://example.test/ws",
      authToken: "tok",
      reconnectInterval: 10,
      maxReconnectAttempts: 1,
      onConnect,
      onDisconnect,
      onMessage,
    });

    client.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain("?token=");

    FakeWebSocket.instances[0]._open();
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(client.isConnected).toBe(true);

    const ok = client.sendTyping();
    expect(ok).toBe(true);
    expect(FakeWebSocket.instances[0].sent[0]).toContain('"typing"');

    FakeWebSocket.instances[0]._message({ type: "pong" });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pong" }),
    );

    // unexpected close triggers reconnect
    FakeWebSocket.instances[0].close(1006, "boom");
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it("warns once when sending while disconnected", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = new WebSocketClient({ url: "ws://example.test/ws" });

    expect(client.send({ type: "message" })).toBe(false);
    expect(client.send({ type: "message" })).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("initializeWebSocket creates singleton client and exposes telemetry", () => {
    const onConnect = vi.fn();

    const client = initializeWebSocket("http://127.0.0.1:8787", "tok", {
      onConnect,
    });

    expect(getWebSocketClient()).toBe(client);

    client.connect();
    FakeWebSocket.instances[0]._open();

    const t = getWebSocketTelemetry();
    expect(t).toBeTruthy();
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
