/**
 * WebSocket Client for real-time communication with ChatState DO
 * Handles connection, auto-reconnect, and event handling
 */

type MessageHandler = (data: WebSocketMessage) => void;
type ConnectionHandler = () => void;

export interface WebSocketMessage {
  type: "ping" | "pong" | "message" | "typing" | "presence";
  payload?: unknown;
  timestamp?: number;
  userId?: string;
}

interface WebSocketClientOptions {
  url: string;
  authToken?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: MessageHandler;
  onConnect?: ConnectionHandler;
  onDisconnect?: ConnectionHandler;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private authToken?: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalClose = false;
  private warnedCannotSendThisCycle = false;

  private telemetry = {
    firstConnectedAtMs: null as number | null,
    connectCount: 0,
    reconnectAttemptCount: 0,
    unexpectedCloseCount: 0,
    lastClose: null as null | { code: number; reason: string },
  };

  private onMessage?: MessageHandler;
  private onConnect?: ConnectionHandler;
  private onDisconnect?: ConnectionHandler;

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.authToken = options.authToken;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
    this.onMessage = options.onMessage;
    this.onConnect = options.onConnect;
    this.onDisconnect = options.onDisconnect;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.isIntentionalClose = false;
    this.warnedCannotSendThisCycle = false;

    try {
      // Append auth token as query param if provided
      const wsUrl = this.authToken
        ? `${this.url}?token=${encodeURIComponent(this.authToken)}`
        : this.url;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (import.meta.env.DEV) {
          console.log("[WS] Connected");
        }

        this.telemetry.connectCount++;
        if (this.telemetry.firstConnectedAtMs === null) {
          this.telemetry.firstConnectedAtMs = Date.now();
        }

        this.reconnectAttempts = 0;
        this.warnedCannotSendThisCycle = false;
        this.startPing();
        this.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          this.onMessage?.(data);
        } catch {
          // Silently ignore parse errors
        }
      };

      this.ws.onclose = (evt) => {
        // Prod-safe one-line close-code logging.
        try {
          const e = evt as CloseEvent;
          this.telemetry.lastClose = { code: e.code, reason: e.reason };
          if (!this.isIntentionalClose && e.code !== 1000) {
            this.telemetry.unexpectedCloseCount++;
          }
          console.info("[WS] Closed", {
            code: e.code,
            reason: e.reason,
            wasClean: e.wasClean,
          });
        } catch {
          console.info("[WS] Closed");
        }

        this.stopPing();
        this.onDisconnect?.();

        if (!this.isIntentionalClose) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        // Silently handle errors - onclose will be called
      };
    } catch {
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.isIntentionalClose = true;
    this.stopPing();
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      // Throttle to one warning per reconnect cycle.
      if (!this.warnedCannotSendThisCycle) {
        console.warn("[WS] Cannot send (not connected)");
        this.warnedCannotSendThisCycle = true;
      }
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("[WS] Failed to send:", error);
      return false;
    }
  }

  sendTyping(): boolean {
    return this.send({ type: "typing" });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping", timestamp: Date.now() });
    }, 30000); // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (import.meta.env.DEV) {
        console.log("[WS] Max reconnect attempts reached");
      }
      return;
    }

    this.reconnectAttempts++;
    this.telemetry.reconnectAttemptCount++;
    const delay = this.computeReconnectDelayMs();
    if (import.meta.env.DEV) {
      console.log(
        `[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
    }
    this.warnedCannotSendThisCycle = false;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private computeReconnectDelayMs(): number {
    const base = this.reconnectInterval;
    const exp = Math.min(4, this.reconnectAttempts - 1);
    const unjittered = Math.min(15000, base * Math.pow(2, exp));
    const jitter = 0.5 + Math.random(); // 0.5x..1.5x
    return Math.round(unjittered * jitter);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  getTelemetrySnapshot(): {
    firstConnectedAtMs: number | null;
    connectCount: number;
    reconnectAttemptCount: number;
    unexpectedCloseCount: number;
    lastClose: null | { code: number; reason: string };
  } {
    return { ...this.telemetry };
  }
}

// Singleton instance for the app
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient | null {
  return wsClient;
}

export function getWebSocketTelemetry(): ReturnType<
  NonNullable<typeof wsClient>["getTelemetrySnapshot"]
> | null {
  return wsClient ? wsClient.getTelemetrySnapshot() : null;
}

export function initializeWebSocket(
  baseUrl: string,
  authToken?: string,
  handlers?: {
    onMessage?: MessageHandler;
    onConnect?: ConnectionHandler;
    onDisconnect?: ConnectionHandler;
  },
): WebSocketClient {
  if (wsClient) {
    wsClient.disconnect();
  }

  // Convert http(s) to ws(s)
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/v1/ws";

  wsClient = new WebSocketClient({
    url: wsUrl,
    authToken,
    onMessage: handlers?.onMessage,
    onConnect: handlers?.onConnect,
    onDisconnect: handlers?.onDisconnect,
  });

  // DEV-only: expose a stable hook for debugging without UI changes.
  if (import.meta.env.DEV) {
    (
      globalThis as unknown as { __aperionWsTelemetry?: () => unknown }
    ).__aperionWsTelemetry = () => wsClient?.getTelemetrySnapshot() ?? null;
  }

  return wsClient;
}
