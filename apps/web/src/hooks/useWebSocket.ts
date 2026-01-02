import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWebSocketClient,
  initializeWebSocket,
  WebSocketMessage,
} from "../lib/websocket";
import { getDevAuthToken, shouldAppendWebSocketToken } from "../lib/authMode";
import { getApiBaseUrl } from "../lib/apiBaseUrl";

async function shouldConnectWebSocket(
  apiBaseUrl: string,
  warnedRef: { current: boolean },
  signal?: AbortSignal,
): Promise<boolean> {
  const base = apiBaseUrl.replace(/\/$/, "");
  const identityUrl = `${base}/v1/identity`;

  let resp: Response;
  try {
    resp = await fetch(identityUrl, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      signal,
    });
  } catch {
    if (!warnedRef.current) {
      console.info(
        "[WS] Skipping connect: Identity check failed (network error).",
      );
      warnedRef.current = true;
    }
    return false;
  }

  if (resp.status === 200) {
    return true;
  }

  const redirected =
    resp.type === "opaqueredirect" ||
    resp.redirected ||
    (resp.status >= 300 && resp.status < 400) ||
    resp.status === 0;

  if (redirected) {
    if (!warnedRef.current) {
      console.info(
        "[WS] Skipping connect: Access session missing (identity endpoint redirected). Complete Access login and reload.",
      );
      warnedRef.current = true;
    }
    return false;
  }

  if (resp.status === 401 || resp.status === 403) {
    if (!warnedRef.current) {
      console.info(
        `[WS] Skipping connect: Not authenticated (identity ${resp.status}). Complete Access login and reload.`,
      );
      warnedRef.current = true;
    }
    return false;
  }

  if (!warnedRef.current) {
    console.info(
      `[WS] Skipping connect: Identity check failed (status ${resp.status}).`,
    );
    warnedRef.current = true;
  }
  return false;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  typingUsers: string[];
  sendTyping: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const warnedSkipRef = useRef(false);

  useEffect(() => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = shouldAppendWebSocketToken()
      ? getDevAuthToken()
      : undefined;

    const client = initializeWebSocket(apiBaseUrl, authToken, {
      onConnect: () => {
        setIsConnected(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
        setTypingUsers([]);
      },
      onMessage: (data: WebSocketMessage) => {
        switch (data.type) {
          case "typing":
            if (data.userId) {
              setTypingUsers((prev) => {
                if (!prev.includes(data.userId!)) {
                  return [...prev, data.userId!];
                }
                return prev;
              });

              // Auto-remove after 3 seconds
              setTimeout(() => {
                setTypingUsers((prev) =>
                  prev.filter((id) => id !== data.userId),
                );
              }, 3000);
            }
            break;

          case "pong":
            // Heartbeat received, connection is alive
            break;

          default:
            break;
        }
      },
    });

    // Auto-connect (only if identity endpoint is reachable without Access redirect).
    const abort = new AbortController();
    void (async () => {
      const ok = await shouldConnectWebSocket(
        apiBaseUrl,
        warnedSkipRef,
        abort.signal,
      );
      if (ok) client.connect();
    })();

    // Cleanup on unmount
    return () => {
      abort.abort();
      client.disconnect();
    };
  }, []);

  const sendTyping = useCallback(() => {
    getWebSocketClient()?.sendTyping();
  }, []);

  const connect = useCallback(() => {
    const apiBaseUrl = getApiBaseUrl();
    void (async () => {
      const ok = await shouldConnectWebSocket(apiBaseUrl, warnedSkipRef);
      if (ok) getWebSocketClient()?.connect();
    })();
  }, []);

  const disconnect = useCallback(() => {
    getWebSocketClient()?.disconnect();
  }, []);

  return {
    isConnected,
    typingUsers,
    sendTyping,
    connect,
    disconnect,
  };
}
