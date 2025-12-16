import { describe, it, expect } from "vitest";

describe("Hello World Tests", () => {
  it("should return hello world", () => {
    const helloWorld = () => "hello world";
    expect(helloWorld()).toBe("hello world");
  });
});
