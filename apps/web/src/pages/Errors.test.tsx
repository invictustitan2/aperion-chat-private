// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearErrorEntries, logApiError } from "../lib/errorLog";
import { Errors } from "./Errors";

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

describe("Errors page", () => {
  beforeEach(() => {
    clearErrorEntries();
    // Clear localStorage mock if jsdom supports it fully, usually window.localStorage is enough
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows empty state", async () => {
    renderWithClient(<Errors />);
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
    renderWithClient(<Errors />);

    // It should appear in the list (might need to wait for client/server merge memo)
    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
    expect(
      screen.getByText(/GET http:\/\/localhost:8787\/v1\/episodic/),
    ).toBeInTheDocument();
  });
});
