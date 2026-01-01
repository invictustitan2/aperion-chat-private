export const LOCAL_DEV_API_BASE_URL = "http://127.0.0.1:8787";

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Returns the API base URL used by the browser client.
 *
 * Rules:
 * - If VITE_API_BASE_URL is set, use it (absolute URL or relative path like "/api").
 * - Otherwise:
 *   - In production builds, default to same-origin Path B mount: "/api".
 *   - In dev builds, default to local worker dev server.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  return import.meta.env.PROD ? "/api" : LOCAL_DEV_API_BASE_URL;
}

export function apiBaseUrlHints(baseUrl: string): {
  kind: "relative" | "absolute";
  wouldBeSameOrigin: boolean;
} {
  if (!isAbsoluteHttpUrl(baseUrl)) {
    return { kind: "relative", wouldBeSameOrigin: true };
  }

  try {
    const target = new URL(baseUrl);
    const origin = globalThis.location?.origin;
    const wouldBeSameOrigin = origin ? target.origin === origin : false;
    return { kind: "absolute", wouldBeSameOrigin };
  } catch {
    return { kind: "absolute", wouldBeSameOrigin: false };
  }
}
