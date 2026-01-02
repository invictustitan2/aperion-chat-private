import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-sts", () => {
  return {
    STSClient: class {
      async send(_cmd: unknown) {
        throw new Error("no aws");
      }
    },
    GetCallerIdentityCommand: class {
      constructor(_opts: unknown) {}
    },
  };
});

vi.mock("@aws-sdk/credential-provider-node", () => {
  return {
    defaultProvider: () => () => ({ accessKeyId: "x", secretAccessKey: "y" }),
  };
});

import { verify } from "../src/commands/verify.js";

function mockExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`Process exit ${code ?? 0}`);
  }) as unknown as typeof process.exit);
}

describe("verify (branch coverage)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    delete process.env.VITE_AUTH_MODE;
    delete process.env.APERION_AUTH_MODE;
    delete process.env.AUTH_TOKEN;
    delete process.env.VITE_AUTH_TOKEN;
    delete process.env.VITE_API_BASE_URL;
  });

  it("warns on token mismatch when server fingerprint differs", async () => {
    process.env.VITE_AUTH_MODE = "access";
    process.env.AUTH_TOKEN = "client-token";
    process.env.VITE_API_BASE_URL = "http://127.0.0.1:8787";

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const headers = new Headers();
    headers.set("x-aperion-auth-fingerprint", "server-different");
    headers.set("x-aperion-trace-id", "trace-123");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers,
        json: async () => [{ id: 1 }],
      })),
    );

    await expect(verify()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("treats 302/401/403 as protected reachability in access mode", async () => {
    process.env.VITE_AUTH_MODE = "access";
    process.env.VITE_API_BASE_URL = "http://127.0.0.1:8787";

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 302,
        statusText: "Found",
        headers: new Headers(),
      })),
    );

    await expect(verify()).resolves.toBeUndefined();
  });

  it("exits non-access failures", async () => {
    const exitSpy = mockExit();

    process.env.VITE_AUTH_MODE = "token";
    process.env.AUTH_TOKEN = "t";
    process.env.VITE_API_BASE_URL = "http://127.0.0.1:8787";

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: "Oops",
        headers: new Headers(),
      })),
    );

    await expect(verify()).rejects.toThrow("Process exit 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when connectivity check throws", async () => {
    const exitSpy = mockExit();

    process.env.VITE_AUTH_MODE = "access";
    process.env.VITE_API_BASE_URL = "http://127.0.0.1:8787";

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );

    await expect(verify()).rejects.toThrow("Process exit 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
