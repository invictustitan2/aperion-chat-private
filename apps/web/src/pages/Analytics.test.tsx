// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "./Analytics";

vi.mock("../lib/api", () => ({
  api: {
    analytics: {
      dashboard: vi.fn().mockResolvedValue({
        generatedAt: 1,
        days: [
          {
            date: "2025-01-01",
            episodicCount: 2,
            semanticCount: 1,
            userMessages: 1,
            assistantMessages: 1,
          },
        ],
        summary: [
          {
            range: "24h",
            episodicCount: 2,
            semanticCount: 1,
            userMessages: 1,
            assistantMessages: 1,
          },
          {
            range: "7d",
            episodicCount: 2,
            semanticCount: 1,
            userMessages: 1,
            assistantMessages: 1,
          },
          {
            range: "30d",
            episodicCount: 2,
            semanticCount: 1,
            userMessages: 1,
            assistantMessages: 1,
          },
        ],
        topics: [{ term: "typescript", count: 3 }],
        aiUsage: { assistantMessages30d: 10, avgAssistantChars30d: 120 },
      }),
    },
  },
}));

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and summary", async () => {
    renderWithClient(<Analytics />);

    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    expect(await screen.findByText("Memory Growth")).toBeInTheDocument();
    expect(await screen.findByText("Topic Distribution")).toBeInTheDocument();
    expect(await screen.findByText("AI Usage")).toBeInTheDocument();

    expect(screen.getByText("typescript")).toBeInTheDocument();
  });
});
