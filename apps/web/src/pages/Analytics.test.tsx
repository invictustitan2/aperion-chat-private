// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "./Analytics";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    analytics: {
      dashboard: vi.fn(),
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

const mockData = {
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
};

describe("Analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and summary", async () => {
    vi.mocked(api.analytics.dashboard).mockResolvedValue(mockData);
    renderWithClient(<Analytics />);

    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    expect(await screen.findByText("Memory Growth")).toBeInTheDocument();
    expect(await screen.findByText("Topic Distribution")).toBeInTheDocument();
    expect(await screen.findByText("AI Usage")).toBeInTheDocument();

    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(api.analytics.dashboard).mockReturnValue(new Promise(() => {}));
    renderWithClient(<Analytics />);
    expect(screen.getByText(/Loading analytics/i)).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.mocked(api.analytics.dashboard).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    renderWithClient(<Analytics />);
    expect(
      await screen.findByText(/Failed to load analytics/i),
    ).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    vi.mocked(api.analytics.dashboard).mockResolvedValue(null);
    renderWithClient(<Analytics />);
    expect(await screen.findByText("No analytics data.")).toBeInTheDocument();
  });

  it("refetches when range changes", async () => {
    vi.mocked(api.analytics.dashboard).mockResolvedValue(mockData);
    renderWithClient(<Analytics />);

    await screen.findByText("Analytics");

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "7" } });

    await waitFor(() => {
      expect(api.analytics.dashboard).toHaveBeenCalledWith(7);
    });
  });
});
