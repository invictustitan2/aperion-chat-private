// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Memory } from "./Memory";
import { api } from "../lib/api";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    identity: {
      list: vi.fn(),
    },
    episodic: {
      list: vi.fn(),
      update: vi.fn(),
    },
    semantic: {
      search: vi.fn(),
      summarize: vi.fn(),
    },
    jobs: {
      get: vi.fn(),
    },
    relationships: {
      list: vi.fn(),
      create: vi.fn(),
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
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

async function activateTab(name: string) {
  const tab = screen.getByRole("tab", { name });
  // Radix Tabs uses onMouseDown (not onClick) to activate.
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab, { button: 0 });
  // Fallback for environments where mouse events don't trigger activation.
  fireEvent.keyDown(tab, { key: "Enter" });
  await waitFor(() => {
    expect(tab).toHaveAttribute("aria-selected", "true");
  });
}

describe("Memory Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header and default tab (Identity)", async () => {
    vi.mocked(api.identity.list).mockResolvedValue([]);
    renderWithClient(<Memory />);

    expect(screen.getByText("Memory Store")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Identity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByText("No identity records found."),
    ).toBeInTheDocument();
  });

  it("switches to Episodic Log tab", async () => {
    vi.mocked(api.episodic.list).mockResolvedValue([]);
    renderWithClient(<Memory />);

    await activateTab("Episodic Log");
    expect(await screen.findByText("Showing 0 of 0")).toBeInTheDocument();
  });

  it("switches to Semantic Search tab and performs search", async () => {
    vi.mocked(api.semantic.search).mockResolvedValue([
      {
        id: "1",
        content: "Test memory content",
        score: 0.9,
        createdAt: Date.now(),
        provenance: { source_type: "chat", source_id: "123" },
        references: [],
      },
    ]);

    renderWithClient(<Memory />);

    // Switch to Semantic Search
    await activateTab("Semantic Search");

    // Check empty state
    expect(
      screen.getByText(/Search your semantic memory/i),
    ).toBeInTheDocument();

    // Perform search
    const input = await screen.findByPlaceholderText(/Search semantic memory/i);
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.click(screen.getByText("Search"));

    // Check results
    expect(await screen.findByText("Test memory content")).toBeInTheDocument();
    expect(screen.getByText("90.0%")).toBeInTheDocument();
  });

  it("expands search result and shows details", async () => {
    vi.mocked(api.semantic.search).mockResolvedValue([
      {
        id: "1",
        content: "Test memory content",
        score: 0.9,
        createdAt: Date.now(),
        provenance: { source_type: "chat", source_id: "123" },
        references: [],
      },
    ]);
    vi.mocked(api.relationships.list).mockResolvedValue([]);

    renderWithClient(<Memory />);

    await activateTab("Semantic Search");

    const input = await screen.findByPlaceholderText(/Search semantic memory/i);
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.click(screen.getByText("Search"));

    const result = await screen.findByText("Test memory content");
    fireEvent.click(result);

    expect(screen.getByText("Full Content")).toBeInTheDocument();
    expect(screen.getByText("Relationships")).toBeInTheDocument();
  });

  it("handles search errors", async () => {
    vi.mocked(api.semantic.search).mockRejectedValue(
      new Error("Search failed"),
    );

    renderWithClient(<Memory />);

    await activateTab("Semantic Search");

    const input = await screen.findByPlaceholderText(/Search semantic memory/i);
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.click(screen.getByText("Search"));

    expect(await screen.findByText("Search failed")).toBeInTheDocument();
  });

  it("manages relationships (list and create)", async () => {
    const mockResult = {
      id: "sem-1",
      content: "Semantic memory content",
      score: 0.95,
      createdAt: Date.now(),
      provenance: { source_type: "chat", source_id: "chat-123" },
      references: ["ep-1"],
    };

    vi.mocked(api.semantic.search).mockResolvedValue([mockResult]);
    vi.mocked(api.relationships.list).mockResolvedValue([
      {
        id: "rel-1",
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "ep-1",
        toKind: "semantic",
        toId: "sem-1",
        rationale: "Supports this memory",
        confidence: 0.8,
        createdAt: Date.now(),
        createdBy: "system",
      },
    ]);
    vi.mocked(api.relationships.create).mockResolvedValue({
      success: true,
      relationship: {
        id: "rel-new",
        type: "EVIDENCE_FOR",
        fromKind: "episodic",
        fromId: "ep-1",
        toKind: "semantic",
        toId: "sem-1",
        rationale: "New relationship",
        createdAt: Date.now(),
        createdBy: "user",
      },
    });

    renderWithClient(<Memory />);

    // Navigate and Search

    await activateTab("Semantic Search");
    const input = await screen.findByPlaceholderText(/Search semantic memory/i);
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.click(screen.getByText("Search"));

    // Expand Result
    const resultCard = await screen.findByText("Semantic memory content");
    fireEvent.click(resultCard);

    // Verify List
    expect(await screen.findByText("Supports this memory")).toBeInTheDocument();
    expect(screen.getAllByText("EVIDENCE_FOR").length).toBeGreaterThan(0);
    expect(screen.getByText("← episodic:ep-1")).toBeInTheDocument();

    // Create New Relationship
    fireEvent.change(
      screen.getByPlaceholderText("from_id (e.g. episodic UUID)"),
      {
        target: { value: "ep-2" },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Rationale (why this changes reasoning)"),
      {
        target: { value: "New rationale" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("confidence (0..1)"), {
      target: { value: "0.9" },
    });

    const addButton = screen.getByText("Add");
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(api.relationships.create).toHaveBeenCalledWith({
        type: "EVIDENCE_FOR",
        from_kind: "episodic",
        from_id: "ep-2",
        to_kind: "semantic",
        to_id: "sem-1",
        rationale: "New rationale",
        created_by: "user",
        confidence: 0.9,
      });
    });
  });
});
