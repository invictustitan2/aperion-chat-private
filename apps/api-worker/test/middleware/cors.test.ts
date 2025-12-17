import { describe, expect, it } from "vitest";
import { getCorsHeaders } from "../../src/middleware/cors";
import { IRequest } from "itty-router";

describe("CORS Middleware", () => {
  it("should allow localhost origins", () => {
    const req = {
      headers: new Map([["Origin", "http://localhost:5173"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("should allow production origin", () => {
    const req = {
      headers: new Map([["Origin", "https://chat.aperion.cc"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://chat.aperion.cc",
    );
  });

  it("should default to production origin for unknown origins", () => {
    const req = {
      headers: new Map([["Origin", "https://evil.com"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://chat.aperion.cc",
    );
  });

  it("should return standard CORS headers", () => {
    const req = {
      headers: new Map([["Origin", "https://chat.aperion.cc"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });
});
