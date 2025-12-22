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
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("should allow production origin", () => {
    const req = {
      headers: new Map([["Origin", "https://chat.aperion.cc"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://chat.aperion.cc",
    );
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("should not allow unknown origins", () => {
    const req = {
      headers: new Map([["Origin", "https://evil.com"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    expect(headers["Vary"]).toBeUndefined();
  });

  it("should return standard CORS headers", () => {
    const req = {
      headers: new Map([["Origin", "https://chat.aperion.cc"]]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    expect(headers["Access-Control-Allow-Headers"]).toContain("Content-Type");
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should include safe requested preflight headers and vary", () => {
    const req = {
      headers: new Map([
        ["Origin", "https://chat.aperion.cc"],
        [
          "Access-Control-Request-Headers",
          "content-type, x-aperion-client-version",
        ],
      ]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://chat.aperion.cc",
    );
    expect(headers["Access-Control-Allow-Headers"].toLowerCase()).toContain(
      "x-aperion-client-version",
    );
    expect(headers["Vary"]).toBe("Origin, Access-Control-Request-Headers");
  });

  it("should not include unknown requested headers", () => {
    const req = {
      headers: new Map([
        ["Origin", "https://chat.aperion.cc"],
        ["Access-Control-Request-Headers", "x-evil-header"],
      ]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Headers"].toLowerCase()).not.toContain(
      "x-evil-header",
    );
    expect(headers["Vary"]).toBe("Origin, Access-Control-Request-Headers");
  });

  it("should normalize requested headers (case/whitespace/dedupe)", () => {
    const req = {
      headers: new Map([
        ["Origin", "https://chat.aperion.cc"],
        [
          "Access-Control-Request-Headers",
          "  content-type,  X-APERION-TRACE ,x-aperion-trace, CF-Access-Jwt-Assertion  ,authorization ",
        ],
      ]),
    } as unknown as IRequest;

    const headers = getCorsHeaders(req);
    const allowRaw = headers["Access-Control-Allow-Headers"];
    const allowList = allowRaw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    // Assert set equality (order-independent) and dedupe.
    const allowSet = new Set(allowList);
    const expected = new Set([
      "content-type",
      "authorization",
      "cf-access-jwt-assertion",
      "cf-access-client-id",
      "cf-access-client-secret",
      "x-aperion-trace",
    ]);

    expect(allowSet).toEqual(expected);
    expect(allowList.filter((h) => h === "x-aperion-trace").length).toBe(1);
    expect(headers["Vary"]).toBe("Origin, Access-Control-Request-Headers");
  });
});
