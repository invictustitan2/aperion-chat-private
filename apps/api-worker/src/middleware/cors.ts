import { IRequest } from "itty-router";

export function getCorsHeaders(request: IRequest): Record<string, string> {
  const origin = request.headers.get("Origin");
  const requestedHeadersRaw = request.headers.get(
    "Access-Control-Request-Headers",
  );

  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://chat.aperion.cc",
  ];

  const baseAllowHeaders = [
    "Content-Type",
    "Authorization",
    "CF-Access-Jwt-Assertion",
    "CF-Access-Client-Id",
    "CF-Access-Client-Secret",
  ];

  const parsedRequestedHeaders = (requestedHeadersRaw || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  // Allow a safe superset for preflight: known auth/content headers, plus X-Aperion-*.
  // (CORS allows sending extra headers only from allowed origins; this list prevents
  // accidental broadening to arbitrary header names.)
  const safeRequestedHeaders = parsedRequestedHeaders.filter((h) => {
    const lower = h.toLowerCase();
    if (lower === "content-type") return true;
    if (lower === "authorization") return true;
    if (lower === "cf-access-jwt-assertion") return true;
    if (lower === "cf-access-client-id") return true;
    if (lower === "cf-access-client-secret") return true;
    if (lower.startsWith("x-aperion-")) return true;
    return false;
  });

  const allowHeaders = Array.from(
    new Map(
      [...baseAllowHeaders, ...safeRequestedHeaders].map((h) => [
        h.toLowerCase(),
        h,
      ]),
    ).values(),
  ).join(", ");

  // If Origin is present, only reflect it when explicitly allowed.
  // If Origin is absent (non-browser / same-origin), we set a stable value.
  const isAllowed = origin ? allowedOrigins.includes(origin) : false;
  const allowOrigin = origin
    ? isAllowed
      ? origin
      : undefined
    : allowedOrigins[2];

  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Expose-Headers":
      "X-Aperion-Trace-Id, X-Aperion-Auth-Fingerprint",
    "Access-Control-Max-Age": "86400",
  };

  if (!allowOrigin) return base;

  return {
    ...base,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    ...(origin || requestedHeadersRaw
      ? {
          Vary: origin
            ? requestedHeadersRaw
              ? "Origin, Access-Control-Request-Headers"
              : "Origin"
            : "Access-Control-Request-Headers",
        }
      : {}),
  };
}
