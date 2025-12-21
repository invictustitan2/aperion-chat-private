import { IRequest } from "itty-router";
import { Logger } from "../lib/logger";
import { Metrics } from "../lib/metrics";
import { Env } from "../types";
import { computeHash } from "@aperion/shared";

// Extended Request type with Context
export interface ContextRequest extends IRequest {
  ctx: {
    traceId: string;
    authFingerprint: string;
    authUserId?: string;
    logger: Logger;
    metrics: Metrics;
    startTime: number;
  };
}

function sanitizeUrlForLogs(url: string): string {
  try {
    const u = new URL(url);
    // Redact common sensitive query params.
    for (const key of ["token", "access_token", "auth", "authorization"]) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, "[redacted]");
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const withContext = (request: IRequest, env: Env) => {
  const req = request as ContextRequest;
  const traceId = request.headers.get("cf-ray") || crypto.randomUUID();

  // Placeholder: auth middleware will set a meaningful fingerprint after auth resolution.
  // Keep a non-empty value to preserve response header shape.
  const authFingerprint = env.API_TOKEN
    ? computeHash(env.API_TOKEN).slice(0, 12)
    : "pending";

  req.ctx = {
    traceId,
    authFingerprint,
    logger: new Logger(traceId),
    metrics: new Metrics(env),
    startTime: performance.now(),
  };

  // Log incoming request
  const safeUrl = sanitizeUrlForLogs(request.url);
  req.ctx.logger.info(`Incoming request: ${request.method} ${safeUrl}`, {
    method: request.method,
    url: safeUrl,
    userAgent: request.headers.get("user-agent"),
  });
};
