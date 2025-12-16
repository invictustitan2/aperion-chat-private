import { BrowserWorker } from "@cloudflare/puppeteer";
import { Queue } from "@cloudflare/workers-types";
import { MemoryQueueMessage } from "./lib/queue-processor";

export interface Env {
  MEMORY_DB: D1Database;
  MEMORY_VECTORS: VectorizeIndex;
  AI: Ai;
  CHAT_STATE: DurableObjectNamespace;
  MEMORY_QUEUE: Queue<MemoryQueueMessage>;
  MEDIA_BUCKET: R2Bucket;
  BROWSER: BrowserWorker;
  CACHE_KV: KVNamespace;
  METRICS: AnalyticsEngineDataset;
  API_TOKEN: string;
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}
