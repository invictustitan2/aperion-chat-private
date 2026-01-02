import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getGoogleAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("throws if GOOGLE_APPLICATION_CREDENTIALS_JSON is missing", async () => {
    const { getGoogleAccessToken } = await import("./googleAuth");
    await expect(getGoogleAccessToken({})).rejects.toThrow(
      /Missing GOOGLE_APPLICATION_CREDENTIALS_JSON/,
    );
  });

  it("fetches a token, caches it, and avoids refetch within cache window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);

    const importKey = vi
      .spyOn(crypto.subtle, "importKey")
      .mockResolvedValue({} as CryptoKey);
    const sign = vi
      .spyOn(crypto.subtle, "sign")
      .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "tok-1",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    } as unknown as Response);

    const { getGoogleAccessToken } = await import("./googleAuth");

    const env = {
      GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON.stringify({
        client_email: "svc@example.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n",
      }),
    };

    const t1 = await getGoogleAccessToken(env);
    const t2 = await getGoogleAccessToken(env);

    expect(t1).toBe("tok-1");
    expect(t2).toBe("tok-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(importKey).toHaveBeenCalled();
    expect(sign).toHaveBeenCalled();
  });

  it("throws a detailed error when exchange fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000);

    vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
    vi.spyOn(crypto.subtle, "sign").mockResolvedValue(
      new Uint8Array([9]).buffer,
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    } as unknown as Response);

    const { getGoogleAccessToken } = await import("./googleAuth");

    const env = {
      GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON.stringify({
        client_email: "svc@example.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n",
      }),
    };

    await expect(getGoogleAccessToken(env)).rejects.toThrow(
      /Google token exchange failed: 400 bad request/,
    );
  });
});
