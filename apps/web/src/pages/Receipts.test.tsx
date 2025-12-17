import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import { Receipts } from "./Receipts";
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
    receipts: {
      list: vi.fn(),
    },
  },
}));

describe("Receipts Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", async () => {
    vi.mocked(api.receipts.list).mockResolvedValue([]);
    renderWithClient(<Receipts />);
    expect(await screen.findByText("Decision Receipts")).toBeInTheDocument();
    expect(
      screen.getByText("Audit log of AI policy decisions"),
    ).toBeInTheDocument();
  });

  it("lists receipts", async () => {
    const mockReceipts = [
      {
        id: "r1",
        timestamp: Date.now(),
        action: "allow",
        allowed: true,
        reason: "Policy check passed",
      },
      {
        id: "r2",
        timestamp: Date.now(),
        action: "deny",
        allowed: false,
        reason: "Policy violation",
      },
    ];
    vi.mocked(api.receipts.list).mockResolvedValue(mockReceipts);

    renderWithClient(<Receipts />);

    expect(await screen.findByText("ALLOWED")).toBeInTheDocument();
    expect(screen.getByText("Policy check passed")).toBeInTheDocument();
    expect(screen.getByText("ID: r1")).toBeInTheDocument();

    expect(screen.getByText("DENIED")).toBeInTheDocument();
    expect(screen.getByText("Policy violation")).toBeInTheDocument();
    expect(screen.getByText("ID: r2")).toBeInTheDocument();
  });

  it("handles empty state", async () => {
    vi.mocked(api.receipts.list).mockResolvedValue([]);
    renderWithClient(<Receipts />);
    expect(await screen.findByText("No receipts found.")).toBeInTheDocument();
  });

  it("handles API errors", async () => {
    vi.mocked(api.receipts.list).mockRejectedValue(
      new Error("Failed to fetch receipts"),
    );
    renderWithClient(<Receipts />);
    expect(
      await screen.findByText("Error: Failed to fetch receipts"),
    ).toBeInTheDocument();
  });
});
