// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearErrorEntries,
  getErrorEntries,
  logApiError,
  logRuntimeError,
} from "./errorLog";

beforeEach(() => {
  vi.restoreAllMocks();
  clearErrorEntries();
  window.localStorage.clear();
});

describe("errorLog", () => {
  it("records runtime errors", () => {
    logRuntimeError(new Error("boom"));
    const items = getErrorEntries();
    expect(items.length).toBe(1);
    expect(items[0].kind).toBe("runtime");
    expect(items[0].message).toContain("boom");
  });

  it("records api errors", () => {
    logApiError({
      url: "http://x.test/v1/episodic",
      method: "GET",
      status: 500,
      message: "Failed",
      responseBody: "oops",
    });
    const items = getErrorEntries();
    expect(items.length).toBe(1);
    expect(items[0].kind).toBe("api");
    expect(items[0].status).toBe(500);
    expect(items[0].url).toContain("/v1/episodic");
  });

  it("persists to localStorage", () => {
    logRuntimeError("hello");
    const stored = window.localStorage.getItem("aperion:errorLog:v1");
    expect(stored).toBeTruthy();
    // New instance should re-load on getErrorEntries()
    const items = getErrorEntries();
    expect(items.length).toBe(1);
  });
});
