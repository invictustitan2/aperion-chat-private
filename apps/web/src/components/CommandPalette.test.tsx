// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { api } from "../lib/api";
import { toggleTheme } from "../lib/theme";

// Mock API and Theme
vi.mock("../lib/api", () => ({
  api: {
    semantic: {
      search: vi.fn(),
    },
  },
}));

vi.mock("../lib/theme", () => ({
  getTheme: vi.fn(() => "dark"),
  toggleTheme: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(
      screen.getByPlaceholderText("Type a command or search..."),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(
      screen.queryByPlaceholderText("Type a command or search..."),
    ).not.toBeInTheDocument();
  });

  it("navigates to chat", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type a command or search...");
    fireEvent.change(input, { target: { value: "Go to Chat" } });

    const option = screen.getByText("Go to Chat");
    fireEvent.click(option);

    expect(mockNavigate).toHaveBeenCalledWith("/chat");
    expect(onClose).toHaveBeenCalled();
  });

  it("performs memory search", async () => {
    vi.mocked(api.semantic.search).mockResolvedValue([
      {
        id: "1",
        content: "Found memory",
        score: 0.9,
        createdAt: Date.now(),
      },
    ]);

    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type a command or search...");
    fireEvent.change(input, { target: { value: "search: test" } });

    // Wait for debounce/search
    await waitFor(() => {
      expect(api.semantic.search).toHaveBeenCalledWith("search: test", 5);
    });

    expect(await screen.findByText("Found memory")).toBeInTheDocument();
  });

  it("navigates with keyboard", () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type a command or search...");

    // Initial selection should be the first item
    // We can check if the first item has a specific class or style indicating selection
    // But without knowing the exact implementation details (classes), it's hard to assert selection visually.
    // However, we can test that pressing Enter on the first item triggers the action.

    // Press ArrowDown
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Now the second item should be selected.
    // Let's assume the order of commands.
    // 1. Go to Chat
    // 2. Go to Memory

    // Press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockNavigate).toHaveBeenCalledWith("/memory");
  });

  it("toggles theme", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={onClose} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type a command or search...");
    fireEvent.change(input, { target: { value: "Toggle Theme" } });

    const option = screen.getByText("Toggle Theme");
    fireEvent.click(option);

    expect(toggleTheme).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
