import { describe, it, expect } from "vitest";

describe("Hello World Tests", () => {
  it("should return true when 1 + 1 equals 2", () => {
    expect(1 + 1).toBe(2);
  });

  it("should return false when 1 + 1 does not equal 3", () => {
    expect(1 + 1).not.toBe(3);
  });
});
