import { render, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock("../lib/websocket", () => {
  return {
    initializeWebSocket: vi.fn(() => ({
      connect: connectMock,
      disconnect: disconnectMock,
    })),
    getWebSocketClient: vi.fn(() => ({
      connect: connectMock,
      disconnect: disconnectMock,
      sendTyping: vi.fn(),
    })),
  };
});

vi.mock("../lib/apiBaseUrl", () => {
  return {
    getApiBaseUrl: () => "/api",
  };
});

describe("useWebSocket WS preflight", () => {
  it("connects only when identity preflight returns 200", async () => {
    connectMock.mockClear();
    disconnectMock.mockClear();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })) as unknown,
    );

    const { useWebSocket } = await import("./useWebSocket");

    function Test() {
      useWebSocket();
      return null;
    }

    render(<Test />);

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(1);
    });
  });

  it("skips connect when identity is redirected by Access", async () => {
    connectMock.mockClear();
    disconnectMock.mockClear();

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            status: 0,
            type: "opaqueredirect",
            redirected: false,
          }) as unknown as Response,
      ),
    );

    const { useWebSocket } = await import("./useWebSocket");

    function Test() {
      useWebSocket();
      return null;
    }

    render(<Test />);

    await waitFor(() => {
      expect(infoSpy).toHaveBeenCalledWith(
        "[WS] Skipping connect: Access session missing (identity endpoint redirected). Complete Access login and reload.",
      );
    });
    expect(connectMock).not.toHaveBeenCalled();

    infoSpy.mockRestore();
  });
});
