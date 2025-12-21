import { IRequest } from "itty-router";

export function getCorsHeaders(request: IRequest): Record<string, string> {
  const origin = request.headers.get("Origin") || "";

  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://chat.aperion.cc",
  ];

  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[2],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, CF-Access-Client-Id, CF-Access-Client-Secret",
    "Access-Control-Expose-Headers":
      "X-Aperion-Trace-Id, X-Aperion-Auth-Fingerprint",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}
