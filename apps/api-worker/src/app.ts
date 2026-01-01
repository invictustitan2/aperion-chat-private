import { AutoRouter, IRequest, error } from "itty-router";
import { AnalyticsController } from "./controllers/AnalyticsController";
import { ChatController } from "./controllers/ChatController";
import { ConversationsController } from "./controllers/ConversationsController";
import { EpisodicController } from "./controllers/EpisodicController";
import { IdentityController } from "./controllers/IdentityController";
import { InsightsController } from "./controllers/InsightsController";
import { JobsController } from "./controllers/JobsController";
import { LogsController } from "./controllers/LogsController";
import { MediaController } from "./controllers/MediaController";
import { KnowledgeController } from "./controllers/KnowledgeController";
import { PreferencesController } from "./controllers/PreferencesController";
import { ReceiptsController } from "./controllers/ReceiptsController";
import { RelationshipsController } from "./controllers/RelationshipsController";
import { RunbooksController } from "./controllers/RunbooksController";
import { SemanticController } from "./controllers/SemanticController";
import { VoiceController } from "./controllers/VoiceController";
import { withAuth } from "./middleware/auth";
import { getCorsHeaders } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { Env } from "./types";
import { ContextRequest, withContext } from "./middleware/context";

export function createApp() {
  const router = AutoRouter<IRequest, [Env, ExecutionContext]>({
    finally: [
      (response: Response, request: IRequest) => {
        const corsHeaders = getCorsHeaders(request);
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });

        const ctxReq = request as ContextRequest;
        if (ctxReq.ctx) {
          newHeaders.set("X-Aperion-Trace-Id", ctxReq.ctx.traceId);
          newHeaders.set(
            "X-Aperion-Auth-Fingerprint",
            ctxReq.ctx.authFingerprint,
          );
        }

        // Log completion
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

  // Conversations
  router.get("/v1/conversations", withAuth, ConversationsController.list);
  router.post("/v1/conversations", withAuth, ConversationsController.create);
  router.put("/v1/conversations/:id", withAuth, ConversationsController.rename);
  router.delete(
    "/v1/conversations/:id",
    withAuth,
    ConversationsController.delete,
  );

  // Preferences
  router.get("/v1/preferences/:key", withAuth, PreferencesController.get);
  router.put("/v1/preferences/:key", withAuth, PreferencesController.set);

  // Analytics
  router.get("/v1/analytics", withAuth, AnalyticsController.dashboard);

  // Insights
  router.post("/v1/insights/summary", withAuth, InsightsController.summarize);

  // Episodic
  router.post("/v1/episodic", withAuth, EpisodicController.create);
  router.get("/v1/episodic", withAuth, EpisodicController.list);
  router.put("/v1/episodic/:id", withAuth, EpisodicController.update);
  router.delete("/v1/episodic", withAuth, EpisodicController.delete);

  // Semantic
  router.post("/v1/semantic", withAuth, SemanticController.create);
  router.get("/v1/semantic/search", withAuth, SemanticController.search);
  router.get("/v1/semantic/hybrid", withAuth, SemanticController.hybridSearch);
  router.post("/v1/semantic/summarize", withAuth, SemanticController.summarize);

  // Knowledge
  router.get("/v1/knowledge", withAuth, KnowledgeController.list);
  router.post("/v1/knowledge/promote", withAuth, KnowledgeController.promote);

  // Relationships
  router.get("/v1/relationships", withAuth, RelationshipsController.list);
  router.post("/v1/relationships", withAuth, RelationshipsController.create);

  // Identity
  router.post("/v1/identity", withAuth, IdentityController.upsert);
  router.get("/v1/identity", withAuth, IdentityController.get);

  // Voice
  router.post("/v1/voice-chat", withAuth, VoiceController.handle);
  router.post("/api/voice-chat", withAuth, VoiceController.handle);

  // WebSocket
  router.get("/v1/ws", withAuth, async (request, env) => {
    if (!env.CHAT_STATE) {
      return error(503, "ChatState is not configured");
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

  // Logs
  router.get("/v1/logs", withAuth, LogsController.list);
  router.post("/v1/logs", withAuth, LogsController.create);
  router.delete("/v1/logs", withAuth, LogsController.clear);

  return {
    fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
      try {
        const rewritten = maybeRewritePathForSameOriginMount(request);
        return await router.fetch(rewritten as IRequest, env, ctx);
      } catch (err: unknown) {
        console.error("Unhandled error:", err);
        return errorHandler(err);
      }
    },
  };
}

function maybeRewritePathForSameOriginMount(request: Request): Request {
  const url = new URL(request.url);

  // Path B mount: the browser will call /api/v1/* on chat.aperion.cc.
  // Rewrite only the v1 API surface so we do not break existing non-v1 /api/* routes
  // like /api/voice-chat.
  if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
    url.pathname = url.pathname.replace(/^\/api/, "");
    return new Request(url.toString(), request);
  }

  return request;
}
