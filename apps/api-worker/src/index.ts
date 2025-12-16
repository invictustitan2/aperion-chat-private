import { AutoRouter, IRequest, error } from "itty-router";
import { ChatController } from "./controllers/ChatController";
import { EpisodicController } from "./controllers/EpisodicController";
import { IdentityController } from "./controllers/IdentityController";
import { JobsController } from "./controllers/JobsController";
import { MediaController } from "./controllers/MediaController";
import { ReceiptsController } from "./controllers/ReceiptsController";
import { RunbooksController } from "./controllers/RunbooksController";
import { SemanticController } from "./controllers/SemanticController";
import { VoiceController } from "./controllers/VoiceController";
import { cleanupLogs } from "./lib/janitor";
import { MemoryQueueMessage, processMemoryBatch } from "./lib/queue-processor";
import { withAuth } from "./middleware/auth";
import { getCorsHeaders } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { Env } from "./types";
export { ChatState } from "./do/ChatState";

import { ContextRequest, withContext } from "./middleware/context";

const router = AutoRouter<IRequest, [Env, ExecutionContext]>({
  finally: [
    (response: Response, request: IRequest) => {
      const corsHeaders = getCorsHeaders(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      // Log completion
      const ctxReq = request as ContextRequest;
      if (ctxReq.ctx) {
        const duration = performance.now() - ctxReq.ctx.startTime;
        ctxReq.ctx.logger.info(`Request completed`, {
          status: response.status,
          durationMs: duration,
        });

        // Record latency metric
        ctxReq.ctx.metrics.record({
          name: "http_request_duration",
          labels: {
            method: request.method,
            status: String(response.status),
            path: new URL(request.url).pathname,
          },
          value: duration,
        });
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    },
  ],
});

router.all("*", withContext); // Apply context middleware globally

router.options("*", (request) => {
  const corsHeaders = getCorsHeaders(request);
  return new Response(null, { status: 204, headers: corsHeaders });
});

// Chat
router.post("/v1/chat", withAuth, ChatController.chat);
router.post("/v1/chat/stream", withAuth, ChatController.stream);
router.post("/v1/chat/export", withAuth, ChatController.export);
router.post("/v1/chat/analyze", withAuth, ChatController.analyze);

// Episodic
router.post("/v1/episodic", withAuth, EpisodicController.create);
router.get("/v1/episodic", withAuth, EpisodicController.list);
router.delete("/v1/episodic", withAuth, EpisodicController.delete);

// Semantic
router.post("/v1/semantic", withAuth, SemanticController.create);
router.get("/v1/semantic/search", withAuth, SemanticController.search);
router.get("/v1/semantic/hybrid", withAuth, SemanticController.hybridSearch);
router.post("/v1/semantic/summarize", withAuth, SemanticController.summarize);

// Identity
router.post("/v1/identity", withAuth, IdentityController.upsert);
router.get("/v1/identity", withAuth, IdentityController.get);

// Voice
router.post("/v1/voice-chat", withAuth, VoiceController.handle);
router.post("/api/voice-chat", withAuth, VoiceController.handle);

// WebSocket
router.get("/v1/ws", withAuth, async (request, env) => {
  if (!env.CHAT_STATE) {
    return error(503, "ChatState DO not configured");
  }
  const id = env.CHAT_STATE.idFromName("global-chat");
  const stub = env.CHAT_STATE.get(id);
  return stub.fetch(request);
});

// Media
router.put("/v1/media/:key", withAuth, MediaController.upload);
router.get("/v1/media/:key", withAuth, MediaController.download);

// Utility
router.post("/v1/runbooks/hash", withAuth, RunbooksController.hash);
router.get("/v1/receipts", withAuth, ReceiptsController.list);
router.get("/v1/jobs/:id", withAuth, JobsController.get);

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      return await router.fetch(request as IRequest, env, ctx);
    } catch (err: unknown) {
      console.error("Unhandled error:", err);
      return errorHandler(err);
    }
  },
  queue: async (batch: MessageBatch<MemoryQueueMessage>, env: Env) => {
    await processMemoryBatch(batch.messages, env);
  },
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    // Cleanup old logs
    ctx.waitUntil(
      cleanupLogs(env).then((res) =>
        console.log(`Deleted ${res.deleted} logs`),
      ),
    );

    // Cleanup old rate limit entries
    ctx.waitUntil(
      import("./middleware/rateLimit").then(({ cleanupRateLimits }) =>
        cleanupRateLimits(env).then((res) =>
          console.log(`Deleted ${res.deleted} rate limit entries`),
        ),
      ),
    );
  },
};
