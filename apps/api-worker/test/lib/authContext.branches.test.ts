import { describe, expect, it } from "vitest";
import { getAuthContext } from "../../src/lib/authContext";

describe("getAuthContext (branches)", () => {
  it("authenticates via Cloudflare Access service token headers", async () => {
    const req = new Request("http://local.test/v1/hello", {
      headers: {
        "CF-Access-Client-Id": "svc-id",
        "CF-Access-Client-Secret": "svc-secret",
      },
    });

    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "token",
      CF_ACCESS_SERVICE_TOKEN_ID: "svc-id",
      CF_ACCESS_SERVICE_TOKEN_SECRET: "svc-secret",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: true,
        method: "service-token",
        principalType: "service",
      }),
    );
  });

  it("fails closed with a helpful message when Access JWT is malformed", async () => {
    const req = new Request("http://local.test/v1/hello", {
      headers: {
        "CF-Access-Jwt-Assertion": "not-a-jwt",
      },
    });

    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team",
      CF_ACCESS_AUD: "aud",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: false,
        status: 401,
      }),
    );
    expect((auth as any).reason).toContain("Invalid Access JWT");
    expect((auth as any).reason).toContain("Malformed JWT");
  });

  it("extracts Access token from cookie when header is absent", async () => {
    const req = new Request("http://local.test/v1/hello", {
      headers: {
        Cookie: "other=1; CF_Authorization=cookie-token;",
      },
    });

    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team",
      CF_ACCESS_AUD: "aud",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: false,
        status: 401,
      }),
    );
    expect((auth as any).reason).toContain("Invalid Access JWT");
  });

  it("returns 500 in access mode when Access config is missing", async () => {
    const req = new Request("http://local.test/v1/hello");
    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "access",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: false,
        status: 500,
      }),
    );
  });

  it("returns 401 in access mode when assertion is missing but Access is configured", async () => {
    const req = new Request("http://local.test/v1/hello");
    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team",
      CF_ACCESS_AUD: "aud",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: false,
        status: 401,
      }),
    );
    expect((auth as any).reason).toContain("Missing Access assertion");
  });

  it("includes detail when Authorization scheme is invalid", async () => {
    const req = new Request("http://local.test/v1/hello", {
      headers: {
        Authorization: "Basic abc",
      },
    });

    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "token",
      API_TOKEN: "secret",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: false,
        status: 401,
      }),
    );
    expect((auth as any).reason).toContain("Invalid authentication scheme");
  });

  it("accepts legacy token from query string (websocket/browser fallback)", async () => {
    const req = new Request("http://local.test/v1/ws?token=legacy");
    const auth = await getAuthContext(req, {
      APERION_AUTH_MODE: "token",
      API_TOKEN: "legacy",
    } as any);

    expect(auth).toEqual(
      expect.objectContaining({
        authenticated: true,
        method: "legacy-token",
      }),
    );
  });
});
