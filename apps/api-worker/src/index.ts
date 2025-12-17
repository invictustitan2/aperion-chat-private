import { createApp } from "./app";
import { cleanupLogs } from "./lib/janitor";
import { MemoryQueueMessage, processMemoryBatch } from "./lib/queue-processor";
import type { Env } from "./types";
export { ChatState } from "./do/ChatState";

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    createApp().fetch(request, env, ctx),

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
