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
    logger: Logger;
    metrics: Metrics;
    startTime: number;
  };
}

export const withContext = (request: IRequest, env: Env) => {
  const req = request as ContextRequest;
  const traceId = request.headers.get("cf-ray") || crypto.randomUUID();

  const authFingerprint = env.API_TOKEN
    ? computeHash(env.API_TOKEN).slice(0, 12)
    : "missing";

  req.ctx = {
    traceId,
    authFingerprint,
    logger: new Logger(traceId),
    metrics: new Metrics(env),
    startTime: performance.now(),
  };

  // Log incoming request
  req.ctx.logger.info(`Incoming request: ${request.method} ${request.url}`, {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get("user-agent"),
  });
};
