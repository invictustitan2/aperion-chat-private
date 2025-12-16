import { IRequest } from "itty-router";
import { Logger } from "../lib/logger";
import { Metrics } from "../lib/metrics";
import { Env } from "../types";

// Extended Request type with Context
export interface ContextRequest extends IRequest {
  ctx: {
    traceId: string;
    logger: Logger;
    metrics: Metrics;
    startTime: number;
  };
}

export const withContext = (request: IRequest, env: Env) => {
  const req = request as ContextRequest;
  const traceId = request.headers.get("cf-ray") || crypto.randomUUID();

  req.ctx = {
    traceId,
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
