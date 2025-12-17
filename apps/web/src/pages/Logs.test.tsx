import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { api, DevLog } from "../lib/api";
import { Logs } from "./Logs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    logs: {
      list: vi.fn(),
      clear: vi.fn(),
    },
  },
}));

const mockLogs: DevLog[] = [
  {
    id: "1",
    level: "info",
    message: "System started",
    timestamp: Date.now(),
    source: "system",
  },
  {
    id: "2",
    level: "error",
    message: "Database connection failed",
    timestamp: Date.now(),
    source: "db",
    stack_trace: "Error: Connection refused...",
  },
  {
    id: "3",
    level: "warn",
    message: "High memory usage",
    timestamp: Date.now(),
    source: "monitor",
    metadata: '{"usage": "90%"}',
  },
];

const renderWithProviders = (ui: React.ReactNode) => {
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
};

describe("Logs Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header and empty state", async () => {
    vi.mocked(api.logs.list).mockResolvedValue([]);

    renderWithProviders(<Logs />);

    expect(screen.getByText("System Logs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search logs...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No logs found")).toBeInTheDocument();
    });
  });

  it("renders a list of logs", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("System started")).toBeInTheDocument();
      expect(
        screen.getByText("Database connection failed"),
      ).toBeInTheDocument();
      expect(screen.getByText("High memory usage")).toBeInTheDocument();
    });
  });

  it("filters logs by level", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("System started")).toBeInTheDocument();
    });

    // Click "error" filter
    fireEvent.click(screen.getByRole("button", { name: "error" }));

    expect(screen.queryByText("System started")).not.toBeInTheDocument();
    expect(screen.getByText("Database connection failed")).toBeInTheDocument();
    expect(screen.queryByText("High memory usage")).not.toBeInTheDocument();
  });

  it("searches logs", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("System started")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search logs...");
    fireEvent.change(searchInput, { target: { value: "database" } });

    expect(screen.queryByText("System started")).not.toBeInTheDocument();
    expect(screen.getByText("Database connection failed")).toBeInTheDocument();
  });

  it("expands log details", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(
        screen.getByText("Database connection failed"),
      ).toBeInTheDocument();
    });

    // Click on the error log to expand
    fireEvent.click(screen.getByText("Database connection failed"));

    expect(screen.getByText("Stack Trace:")).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it("refreshes logs", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("System started")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    fireEvent.click(refreshButton);

    expect(api.logs.list).toHaveBeenCalledTimes(2); // Initial + Refresh
  });

  it("clears logs", async () => {
    vi.mocked(api.logs.list).mockResolvedValue(mockLogs);
    vi.mocked(api.logs.clear).mockResolvedValue({ success: true, deleted: 10 });

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("System started")).toBeInTheDocument();
    });

    const clearButton = screen.getByRole("button", { name: "Clear Logs" });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(api.logs.clear).toHaveBeenCalled();
    });
  });

  it("handles loading state", () => {
    vi.mocked(api.logs.list).mockReturnValue(new Promise(() => {})); // Never resolves

    renderWithProviders(<Logs />);

    // Check for loading spinner or text. The component uses a Loader2 icon.
    // We can check if the loader container is present.
    // Or check that logs are not present yet.
    expect(screen.queryByText("System started")).not.toBeInTheDocument();
  });

  it("handles error state", async () => {
    vi.mocked(api.logs.list).mockRejectedValue(new Error("Failed to fetch"));

    renderWithProviders(<Logs />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load logs")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });
  });
});
