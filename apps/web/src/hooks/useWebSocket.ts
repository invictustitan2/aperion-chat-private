import { useCallback, useEffect, useState } from "react";
import {
  getWebSocketClient,
  initializeWebSocket,
  WebSocketMessage,
} from "../lib/websocket";
import { getDevAuthToken, shouldAppendWebSocketToken } from "../lib/authMode";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
const AUTH_TOKEN = shouldAppendWebSocketToken() ? getDevAuthToken() : undefined;

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

  useEffect(() => {
    const client = initializeWebSocket(API_BASE_URL, AUTH_TOKEN, {
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

    // Auto-connect
    client.connect();

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, []);

  const sendTyping = useCallback(() => {
    getWebSocketClient()?.sendTyping();
  }, []);

  const connect = useCallback(() => {
    getWebSocketClient()?.connect();
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
