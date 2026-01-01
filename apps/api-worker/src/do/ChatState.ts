import { DurableObject } from "cloudflare:workers";
import { Env } from "../types";
import {
  getAuthContext,
  getAuthFingerprintFromAuthContext,
} from "../lib/authContext";
import { createPolicyCloseWebSocketUpgradeResponse } from "../lib/wsDeny";

interface WebSocketMessage {
  type: "ping" | "message" | "typing";
  payload?: unknown;
}

export class ChatState extends DurableObject {
  private sessions: Set<WebSocket>;
  private sessionUsers: Map<WebSocket, string>;
  public env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    this.sessions = new Set();
    this.sessionUsers = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const logOutcomes = (
      this.env.APERION_AUTH_LOG_OUTCOMES || "deny"
    ).toLowerCase();
    const traceId = request.headers.get("cf-ray") || undefined;
    const path = (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return request.url;
      }
    })();

    // DO safety invariant: do not rely on auth enforced by the Worker.
    // Re-verify Access/Service/Legacy auth here and fail closed.
    const auth = await getAuthContext(request, this.env);
    if (!auth.authenticated) {
      console.log(
        JSON.stringify({
          level: "info",
          message: "WS upgrade outcome",
          source: "api-worker",
          component: "do.ChatState",
          event: "ws.upgrade",
          outcome: "deny",
          traceId,
          path,
          status: auth.status,
          mode: auth.mode,
          reason: auth.reason,
          closeCode: 1008,
        }),
      );

      return createPolicyCloseWebSocketUpgradeResponse({
        closeCode: 1008,
        closeReason: "Unauthorized",
      });
    }

    if (logOutcomes === "all") {
      console.log(
        JSON.stringify({
          level: "debug",
          message: "WS upgrade outcome",
          source: "api-worker",
          component: "do.ChatState",
          event: "ws.upgrade",
          outcome: "accept",
          traceId,
          path,
          mode: auth.mode,
          authMethod: auth.method,
          principalType: auth.principalType,
          authFingerprint: getAuthFingerprintFromAuthContext(auth),
        }),
      );
    }

    const { 0: client, 1: server } = new WebSocketPair();

    this.handleSession(server, auth.userId);

    // Cloudflare Workers requires a 101 Switching Protocols response for WS.
    // In Node-based unit tests, the global `Response` may reject 101; fall back
    // to a non-upgrade Response so tests can still execute.
    try {
      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit);
    } catch {
      return new Response(null, {
        webSocket: client,
      } as ResponseInit);
    }
  }

  private handleSession(webSocket: WebSocket, userId: string) {
    // Accept the connection
    webSocket.accept();
    this.sessions.add(webSocket);
    this.sessionUsers.set(webSocket, userId);

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
              JSON.stringify({ type: "typing", userId }),
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

    webSocket.addEventListener("close", (evt) => {
      this.sessions.delete(webSocket);
      this.sessionUsers.delete(webSocket);

      // Minimal close-code logging (prod-safe).
      try {
        const e = evt as CloseEvent;
        console.info("[WS] Closed", {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        });
      } catch {
        // ignore
      }
    });

    webSocket.addEventListener("error", () => {
      this.sessions.delete(webSocket);
      this.sessionUsers.delete(webSocket);
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
