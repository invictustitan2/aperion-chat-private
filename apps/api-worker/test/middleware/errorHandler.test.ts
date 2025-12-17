import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middleware/errorHandler";

describe("Error Handler Middleware", () => {
  it("should return 500 with error message for Error objects", async () => {
    const error = new Error("Something went wrong");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorHandler(error);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Something went wrong" });
    expect(consoleSpy).toHaveBeenCalledWith(error);

    consoleSpy.mockRestore();
  });

  it("should return 500 with default message for non-Error objects", async () => {
    const error = "Just a string error";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorHandler(error);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Internal server error" });
    expect(consoleSpy).toHaveBeenCalledWith(error);

    consoleSpy.mockRestore();
  });
});
