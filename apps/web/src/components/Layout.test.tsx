// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";
import { api } from "../lib/api";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    preferences: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
}));

// Mock the theme lib
vi.mock("../lib/theme", async () => {
  const actual = await vi.importActual("../lib/theme");
  return {
    ...actual,
    setTheme: vi.fn(),
    getTheme: vi.fn(() => "dark"),
  };
});

// Mock keyboard shortcuts hook
vi.mock("../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe("Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders navigation links", () => {
    vi.mocked(api.preferences.get).mockResolvedValue({
      value: "dark",
      key: "theme",
      updatedAt: Date.now(),
    });
    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>,
    );

    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Memory").length).toBeGreaterThan(0);
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Receipts")).toBeInTheDocument();
    expect(screen.getByText("System Status")).toBeInTheDocument();
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
  });

  it("loads theme from preferences", async () => {
    vi.mocked(api.preferences.get).mockResolvedValue({
      value: "light",
      key: "theme",
      updatedAt: Date.now(),
    });
    const { setTheme } = await import("../lib/theme");

    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(api.preferences.get).toHaveBeenCalledWith("theme");
      expect(setTheme).toHaveBeenCalledWith("light", { emit: false });
    });
  });

  it.skip("toggles mobile menu", async () => {
    // TODO: Implement mobile menu toggle test. Requires adding test-ids to Layout component.
    // See Phase 5 Roadmap.
  });
});
