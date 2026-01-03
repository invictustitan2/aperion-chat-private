// Global Vitest setup: enforce deterministic tests by blocking outbound network.
// Allowed: localhost / 127.0.0.1 (including relative URLs resolved against localhost).

// Silence app-level logs during tests (prevents noisy stdout and "warn" JSON logs).
(
  globalThis as unknown as { __APERION_LOG_LEVEL__?: string }
).__APERION_LOG_LEVEL = "silent";

if (typeof process !== "undefined") {
  (process as unknown as { env?: Record<string, string> }).env = {
    ...(process as unknown as { env?: Record<string, string> }).env,
    APERION_LOG_LEVEL: "silent",
  };
}

const allowedHosts = new Set(["127.0.0.1", "localhost"]);

const originalFetch = globalThis.fetch;

if (typeof originalFetch === "function") {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Treat relative URLs as local.
    const url = new URL(rawUrl, "http://localhost");

    if (!allowedHosts.has(url.hostname)) {
      throw new Error(`Blocked outbound fetch in tests: ${url.toString()}`);
    }

    return originalFetch(input as RequestInfo, init);
  };
}
