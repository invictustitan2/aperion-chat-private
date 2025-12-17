import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@testing-library/react";
import { Knowledge } from "./Knowledge";
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
    knowledge: {
      list: vi.fn(),
      promote: vi.fn(),
    },
  },
}));

describe("Knowledge Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", async () => {
    vi.mocked(api.knowledge.list).mockResolvedValue([]);
    renderWithClient(<Knowledge />);
    expect(await screen.findByText("Knowledge")).toBeInTheDocument();
    expect(
      screen.getByText("Curated knowledge derived from semantic memories."),
    ).toBeInTheDocument();
  });

  it("lists knowledge items", async () => {
    const mockItems = [
      {
        id: "k1",
        title: "Test Knowledge 1",
        content: "This is some content",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ["tag1", "tag2"],
        sourceSemanticId: "sem1",
      },
      {
        id: "k2",
        title: "Test Knowledge 2",
        content: "More content",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
      },
    ];
    vi.mocked(api.knowledge.list).mockResolvedValue(mockItems);

    renderWithClient(<Knowledge />);

    expect(await screen.findByText("Test Knowledge 1")).toBeInTheDocument();
    expect(screen.getByText("This is some content")).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();

    expect(screen.getByText("Test Knowledge 2")).toBeInTheDocument();
    expect(screen.getByText("More content")).toBeInTheDocument();
  });

  it("handles empty state", async () => {
    vi.mocked(api.knowledge.list).mockResolvedValue([]);
    renderWithClient(<Knowledge />);
    expect(
      await screen.findByText("No knowledge items yet."),
    ).toBeInTheDocument();
  });

  it("handles search", async () => {
    vi.mocked(api.knowledge.list).mockResolvedValue([]);
    renderWithClient(<Knowledge />);

    const searchInput = screen.getByPlaceholderText("Search knowledge...");
    fireEvent.change(searchInput, { target: { value: "query" } });

    // Wait for debounce or effect if any, but here it seems to be direct or on refresh?
    // Looking at code: queryKey: ["knowledge", q], so it refetches on q change.

    await waitFor(() => {
      expect(api.knowledge.list).toHaveBeenCalledWith(100, 0, "query");
    });
  });

  it("promotes semantic memory", async () => {
    vi.mocked(api.knowledge.list).mockResolvedValue([]);
    vi.mocked(api.knowledge.promote).mockResolvedValue({});

    renderWithClient(<Knowledge />);

    const input = screen.getByPlaceholderText("Semantic ID");
    fireEvent.change(input, { target: { value: "sem-123" } });

    const promoteBtn = screen.getByText("Promote");
    fireEvent.click(promoteBtn);

    await waitFor(() => {
      expect(api.knowledge.promote).toHaveBeenCalledWith("sem-123");
    });
  });

  it("handles API errors", async () => {
    vi.mocked(api.knowledge.list).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    renderWithClient(<Knowledge />);
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });
});
