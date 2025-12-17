// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearErrorEntries,
  logApiError,
  logRuntimeError,
} from "../lib/errorLog";
import { SystemStatus } from "./SystemStatus";

// Mock the API to avoid network calls and provide test data
vi.mock("../lib/api", () => ({
  api: {
    dev: {
      logs: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("SystemStatus page", () => {
  beforeEach(() => {
    clearErrorEntries();
    // Clear localStorage mock if jsdom supports it fully, usually window.localStorage is enough
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows empty state", async () => {
    renderWithClient(<SystemStatus />);
    expect(
      await screen.findByText("No logs found for this filter."),
    ).toBeInTheDocument();
  });

  it("renders logged API error", async () => {
    logApiError({
      url: "http://localhost:8787/v1/episodic",
      method: "GET",
      status: 401,
      message: "Unauthorized",
      responseBody: '{"error":"Unauthorized"}',
    });
    renderWithClient(<SystemStatus />);

    // It should appear in the list (might need to wait for client/server merge memo)
    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
    expect(
      screen.getByText(/GET http:\/\/localhost:8787\/v1\/episodic/),
    ).toBeInTheDocument();
  });

  it("filters logs", async () => {
    logApiError({
      url: "/api",
      method: "GET",
      status: 500,
      statusText: "API Error",
      message: "API Error",
    });
    logRuntimeError(new Error("Client Error"));

    renderWithClient(<SystemStatus />);

    // Initially shows both (or at least the count reflects both)
    expect(await screen.findByText("API Error")).toBeInTheDocument();
    expect(screen.getByText("Client Error")).toBeInTheDocument();

    // Filter by Client
    fireEvent.click(screen.getByText("Client Runtime"));
    expect(screen.queryByText("API Error")).not.toBeInTheDocument();
    expect(screen.getByText("Client Error")).toBeInTheDocument();

    // Filter by API
    fireEvent.click(screen.getByText("API Network"));
    expect(screen.getByText("API Error")).toBeInTheDocument();
    expect(screen.queryByText("Client Error")).not.toBeInTheDocument();
  });

  it("clears logs", async () => {
    logRuntimeError(new Error("Test Error"));
    renderWithClient(<SystemStatus />);

    expect(await screen.findByText("Test Error")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear Client Logs"));

    expect(screen.queryByText("Test Error")).not.toBeInTheDocument();
    expect(
      screen.getByText("No logs found for this filter."),
    ).toBeInTheDocument();
  });
});
