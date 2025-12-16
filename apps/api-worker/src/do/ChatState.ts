import { DurableObject } from "cloudflare:workers";
import { Env } from "../types";

interface WebSocketMessage {
  type: "ping" | "message" | "typing";
  payload?: unknown;
}

export class ChatState extends DurableObject {
  private sessions: Set<WebSocket>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(webSocket: WebSocket) {
    // Accept the connection
    webSocket.accept();
    this.sessions.add(webSocket);

    // Set up event listeners
    webSocket.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as WebSocketMessage;

        switch (data.type) {
          case "ping":
            webSocket.send(
              JSON.stringify({ type: "pong", timestamp: Date.now() }),
            );
            break;

          case "typing":
            // Broadcast typing status to OTHER clients
            this.broadcast(
              JSON.stringify({ type: "typing", userId: "operator" }),
              webSocket,
            );
            break;

          case "message":
            // Broadcast new message to ALL clients (including sender for confirmation, or handle optimistic UI)
            // Ideally we'd persist to DB here too via call to API or internal logic
            break;
        }
      } catch (err) {
        // Ignore malformed JSON
      }
    });

    webSocket.addEventListener("close", () => {
      this.sessions.delete(webSocket);
    });

    webSocket.addEventListener("error", () => {
      this.sessions.delete(webSocket);
    });
  }

  private broadcast(message: string, exclude?: WebSocket) {
    for (const session of this.sessions) {
      if (exclude && session === exclude) continue;
      try {
        session.send(message);
      } catch (err) {
        this.sessions.delete(session);
      }
    }
  }
}
