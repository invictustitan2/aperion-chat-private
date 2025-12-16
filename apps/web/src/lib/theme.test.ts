// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getTheme,
  onThemeChange,
  setTheme,
  toggleTheme,
} from "./theme";

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to dark when unset", () => {
    expect(getTheme()).toBe("dark");
  });

  it("setTheme persists and applies", () => {
    setTheme("light");
    expect(window.localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    setTheme("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggleTheme flips between dark and light", () => {
    setTheme("dark");
    expect(toggleTheme()).toBe("light");
    expect(toggleTheme()).toBe("dark");
  });

  it("onThemeChange observes updates", () => {
    const handler = vi.fn();
    const unsubscribe = onThemeChange(handler);

    setTheme("light");
    expect(handler).toHaveBeenCalled();

    unsubscribe();

    setTheme("dark");
    // No additional calls after unsubscribe.
    expect(handler.mock.calls.length).toBe(1);
  });

  it("setTheme can suppress events", () => {
    const handler = vi.fn();
    const unsubscribe = onThemeChange(handler);

    setTheme("light", { emit: false });
    expect(handler).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("applyTheme only updates DOM", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("theme")).toBe(null);
  });
});
