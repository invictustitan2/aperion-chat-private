import { IRequest, error } from "itty-router";
import { Env } from "../types";
import {
  getAuthContext,
  getAuthFingerprintFromAuthContext,
} from "../lib/authContext";
import { ContextRequest } from "./context";

export const withAuth = (request: IRequest, env: Env) => {
  // itty-router supports async middleware (returns Promise<Response|void>).
  return (async () => {
    const startedAt = performance.now();
    const auth = await getAuthContext(request as unknown as Request, env);

    const ctxReq = request as unknown as ContextRequest;
    const logOutcomes = (env.APERION_AUTH_LOG_OUTCOMES || "deny").toLowerCase();

    const safePath = (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return request.url;
      }
    })();

    if (!auth.authenticated) {
      // Keep logs minimal and secret-free.
      const durationMs = Math.round(performance.now() - startedAt);
      if (ctxReq.ctx?.logger) {
        ctxReq.ctx.logger.warn("Auth outcome", {
          event: "auth.outcome",
          outcome: "deny",
          mode: auth.mode,
          method: request.method,
          path: safePath,
          status: auth.status,
          reason: auth.reason,
          durationMs,
        });
      } else {
        console.warn("Authentication failed", {
          path: safePath,
          method: request.method,
          status: auth.status,
          mode: auth.mode,
          reason: auth.reason,
          durationMs,
        });
      }

      return error(auth.status, auth.reason);
    }

    // Attach auth fingerprint + user id into request context for response headers and logging.
    if (ctxReq.ctx) {
      ctxReq.ctx.authFingerprint = getAuthFingerprintFromAuthContext(auth);
      ctxReq.ctx.authUserId = auth.userId;
    }

    // Optional (off by default): record accept outcomes for correlation.
    if (logOutcomes === "all" && ctxReq.ctx?.logger) {
      const durationMs = Math.round(performance.now() - startedAt);
      ctxReq.ctx.logger.debug("Auth outcome", {
        event: "auth.outcome",
        outcome: "accept",
        mode: auth.mode,
        authMethod: auth.method,
        principalType: auth.principalType,
        method: request.method,
        path: safePath,
        status: 200,
        authFingerprint: ctxReq.ctx.authFingerprint,
        durationMs,
      });
    }

    // Attach auth context for handlers/DO helpers if needed.
    (request as unknown as { auth?: unknown }).auth = auth;
  })();
};
