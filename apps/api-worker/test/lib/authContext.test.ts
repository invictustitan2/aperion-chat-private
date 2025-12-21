import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Env } from "../../src/types";

function bytesToBase64Url(bytes: Uint8Array): string {
  // Node btoa is not always available; Buffer is.
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jsonToBase64Url(obj: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function signRs256(privateKey: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(data),
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
}

async function createJwt(opts: {
  kid: string;
  aud: string;
  iss: string;
  email: string;
  privateKey: CryptoKey;
  expSecondsFromNow?: number;
  nbfSecondsFromNow?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: opts.kid, typ: "JWT" };
  const payload = {
    iss: opts.iss,
    aud: opts.aud,
    email: opts.email,
    sub: "sub-1",
    exp: now + (opts.expSecondsFromNow ?? 60),
    nbf: now + (opts.nbfSecondsFromNow ?? -1),
  };

  const h = jsonToBase64Url(header);
  const p = jsonToBase64Url(payload);
  const signingInput = `${h}.${p}`;
  const s = await signRs256(opts.privateKey, signingInput);
  return `${signingInput}.${s}`;
}

describe("getAuthContext (Cloudflare Access)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("verifies CF-Access-Jwt-Assertion via JWKS and caches keys", async () => {
    const { getAuthContext } = await import("../../src/lib/authContext");
    const kp = await generateRsaKeyPair();
    const jwk = (await crypto.subtle.exportKey(
      "jwk",
      kp.publicKey,
    )) as JsonWebKey;
    jwk.kid = "kid-1";

    const env: Env = {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud-1",
    } as Env;

    const iss = "https://team.cloudflareaccess.com";
    const jwt = await createJwt({
      kid: "kid-1",
      aud: "aud-1",
      iss,
      email: "user@example.com",
      privateKey: kp.privateKey,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [jwk] }),
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const req = new Request("https://api.example.com/v1/identity", {
      headers: { "CF-Access-Jwt-Assertion": jwt },
    });

    const a1 = await getAuthContext(req, env);
    expect(a1.authenticated).toBe(true);
    if (a1.authenticated) {
      expect(a1.method).toBe("access-jwt");
      expect(a1.email).toBe("user@example.com");
      expect(a1.userId).toMatch(/^user_/);
    }

    const a2 = await getAuthContext(req, env);
    expect(a2.authenticated).toBe(true);

    // JWKS should be fetched only once due to caching.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes JWKS once when kid is unknown", async () => {
    const { getAuthContext } = await import("../../src/lib/authContext");
    const kp1 = await generateRsaKeyPair();
    const jwk1 = (await crypto.subtle.exportKey(
      "jwk",
      kp1.publicKey,
    )) as JsonWebKey;
    jwk1.kid = "kid-old";

    const kp2 = await generateRsaKeyPair();
    const jwk2 = (await crypto.subtle.exportKey(
      "jwk",
      kp2.publicKey,
    )) as JsonWebKey;
    jwk2.kid = "kid-new";

    const env: Env = {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud-1",
      CF_ACCESS_JWKS_TTL_MS: "600000",
    } as Env;
    const iss = "https://team.cloudflareaccess.com";
    const jwt = await createJwt({
      kid: "kid-new",
      aud: "aud-1",
      iss,
      email: "user@example.com",
      privateKey: kp2.privateKey,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [jwk1] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [jwk2] }),
      });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const req = new Request("https://api.example.com/v1/identity", {
      headers: { "CF-Access-Jwt-Assertion": jwt },
    });

    const auth = await getAuthContext(req, env);
    expect(auth.authenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed in access mode when assertion is missing", async () => {
    const { getAuthContext } = await import("../../src/lib/authContext");
    const env: Env = {
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud-1",
    } as Env;

    const req = new Request("https://api.example.com/v1/identity");
    const auth = await getAuthContext(req, env);
    expect(auth.authenticated).toBe(false);
    if (!auth.authenticated) {
      expect(auth.status).toBe(401);
      expect(auth.reason).toMatch(/Missing Access assertion/i);
    }
  });

  it("supports legacy token auth in token mode", async () => {
    const { getAuthContext } = await import("../../src/lib/authContext");
    const env: Env = {
      APERION_AUTH_MODE: "token",
      API_TOKEN: "t",
    } as Env;

    const req = new Request("https://api.example.com/v1/identity", {
      headers: { Authorization: "Bearer t" },
    });
    const auth = await getAuthContext(req, env);
    expect(auth.authenticated).toBe(true);
    if (auth.authenticated) {
      expect(auth.method).toBe("legacy-token");
    }
  });
});
