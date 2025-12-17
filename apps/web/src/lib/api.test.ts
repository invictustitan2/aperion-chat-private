import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./api";
import * as errorLog from "./errorLog";

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock error logging
vi.mock("./errorLog", () => ({
  logApiError: vi.fn(),
}));

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe("fetchJson wrapper", () => {
    it("should return data on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      const result = await api.preferences.get("test-key");
      expect(result).toEqual({ data: "test" });
    });

    it("should throw and log error on non-200 response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify({ error: "Custom error" }),
      });

      await expect(api.preferences.get("test-key")).rejects.toThrow(
        "Custom error",
      );
      expect(errorLog.logApiError).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          responseBody: JSON.stringify({ error: "Custom error" }),
        }),
      );
    });

    it("should handle non-JSON error responses", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Raw text error",
      });

      await expect(api.preferences.get("test-key")).rejects.toThrow(
        "Raw text error",
      );
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network failure"));

      await expect(api.preferences.get("test-key")).rejects.toThrow(
        "Network failure",
      );
      expect(errorLog.logApiError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Get preference test-key failed",
          responseBody: "Network failure",
        }),
      );
    });
  });

  describe("Endpoints", () => {
    it("analytics.dashboard calls correct URL", async () => {
      await api.analytics.dashboard(7);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/analytics?days=7"),
        expect.any(Object),
      );
    });

    it("conversations.list calls correct URL", async () => {
      await api.conversations.list(10, 100);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/conversations?limit=10&since=100"),
        expect.any(Object),
      );
    });

    it("conversations.create sends POST", async () => {
      await api.conversations.create("New Chat");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/conversations"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "New Chat" }),
        }),
      );
    });

    it("episodic.list handles query params", async () => {
      await api.episodic.list(20, { since: 50, conversationId: "abc" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "/v1/episodic?limit=20&since=50&conversation_id=abc",
        ),
        expect.any(Object),
      );
    });
  });
});
