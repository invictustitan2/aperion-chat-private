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
        this.reconnectAttempts = 0;
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

      this.ws.onclose = () => {
        if (import.meta.env.DEV) {
          console.log("[WS] Disconnected");
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
      console.warn("[WS] Cannot send, not connected");
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
    if (import.meta.env.DEV) {
      console.log(
        `[WS] Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Singleton instance for the app
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient | null {
  return wsClient;
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

  return wsClient;
}
