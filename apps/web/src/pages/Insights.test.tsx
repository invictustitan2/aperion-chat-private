import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@testing-library/react";
import { Insights } from "./Insights";
import { api } from "../lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    insights: {
      summarize: vi.fn(),
    },
    jobs: {
      get: vi.fn(),
    },
  },
}));

describe("Insights Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", () => {
    renderWithClient(<Insights />);
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Summaries and patterns generated from your stored memories.",
      ),
    ).toBeInTheDocument();
  });

  it("triggers summarization and displays result (immediate)", async () => {
    vi.mocked(api.insights.summarize).mockResolvedValue({
      success: true,
      status: "completed",
      summary: "This is a summary.",
      sources: [{ type: "semantic", id: "sem1" }],
    });

    renderWithClient(<Insights />);

    const input = screen.getByPlaceholderText(
      "Optional: what should we focus on?",
    );
    fireEvent.change(input, { target: { value: "My query" } });

    const generateBtn = screen.getByText("Generate");
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.insights.summarize).toHaveBeenCalledWith("My query");
    });

    expect(await screen.findByText("This is a summary.")).toBeInTheDocument();
    expect(screen.getByText("semantic:sem1")).toBeInTheDocument();
  });

  it("handles queued job and polls for result", async () => {
    // 1. Start job -> queued
    vi.mocked(api.insights.summarize).mockResolvedValue({
      success: true,
      status: "queued",
      jobId: "job-123",
      sources: [],
    });

    // 2. Poll -> pending (optional, but good to test)
    // 3. Poll -> completed
    vi.mocked(api.jobs.get)
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "completed", result: "Polled summary" });

    renderWithClient(<Insights />);

    const generateBtn = screen.getByText("Generate");
    fireEvent.click(generateBtn);

    expect(await screen.findByText("Working…")).toBeInTheDocument();

    // Wait for polling to complete
    expect(await screen.findByText("Polled summary")).toBeInTheDocument();
    expect(api.jobs.get).toHaveBeenCalledWith("job-123");
  });

  it("handles job failure", async () => {
    vi.mocked(api.insights.summarize).mockResolvedValue({
      success: true,
      status: "queued",
      jobId: "job-fail",
      sources: [],
    });

    vi.mocked(api.jobs.get).mockResolvedValue({
      status: "failed",
      error: "Something went wrong",
    });

    renderWithClient(<Insights />);

    const generateBtn = screen.getByText("Generate");
    fireEvent.click(generateBtn);

    expect(
      await screen.findByText("Failed: Something went wrong"),
    ).toBeInTheDocument();
  });

  it("handles API error on start", async () => {
    vi.mocked(api.insights.summarize).mockRejectedValue(
      new Error("Start failed"),
    );

    renderWithClient(<Insights />);

    const generateBtn = screen.getByText("Generate");
    fireEvent.click(generateBtn);

    expect(await screen.findByText("Start failed")).toBeInTheDocument();
  });
});
