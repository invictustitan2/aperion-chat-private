// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function Consumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved">{resolvedTheme}</div>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light", "dark");

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("provides theme state and persists updates", async () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(window.localStorage.getItem("aperion-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(window.localStorage.getItem("aperion-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("throws if used outside provider", () => {
    function BadConsumer() {
      useTheme();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
  });
});
