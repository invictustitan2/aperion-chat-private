import { EpisodicRecord, IdentityRecord } from "@aperion/memory-core";
import { logApiError } from "./errorLog";
import { isDevRuntime } from "./authMode";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
const authHeaders: Record<string, string> = {};

if (isDevRuntime()) {
  // DEV-only note: browser auth should come from Access session cookies/headers.
  // Keep message free of env var names to avoid shipping hints.
  console.info("[dev] Web auth expects an active Access session.");
}

if (!import.meta.env.VITE_API_BASE_URL) {
  console.info(
    "VITE_API_BASE_URL is not set, defaulting to http://127.0.0.1:8787. Set it to your deployed Worker URL to avoid CORS.",
  );
}

const headers = {
  Accept: "application/json",
  ...authHeaders,
};

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function normalizeRequestInit(init?: RequestInit): RequestInit {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body;

  const normalizedHeaders = new Headers(init?.headers);

  // Always request JSON by default.
  if (!normalizedHeaders.has("Accept")) {
    normalizedHeaders.set("Accept", "application/json");
  }

  // Avoid accidental CORS preflights on GET/HEAD by not sending Content-Type.
  if ((method === "GET" || method === "HEAD") && body == null) {
    normalizedHeaders.delete("Content-Type");
    normalizedHeaders.delete("content-type");
  }

  // If there is a string body and no explicit Content-Type, assume JSON.
  // Do not override for FormData / Blob / File uploads (browser sets boundaries/types).
  if (
    body != null &&
    typeof body === "string" &&
    !normalizedHeaders.has("Content-Type") &&
    !normalizedHeaders.has("content-type")
  ) {
    normalizedHeaders.set("Content-Type", "application/json");
  }

  // If the caller passed FormData but also mistakenly set Content-Type, remove it.
  if (body != null && isFormData(body)) {
    normalizedHeaders.delete("Content-Type");
    normalizedHeaders.delete("content-type");
  }

  return {
    ...init,
    // Required for Cloudflare Access session cookies in the browser.
    credentials: init?.credentials ?? "include",
    headers: normalizedHeaders,
  };
}

// Define ReceiptRecord if missing from core
export interface ReceiptRecord {
  id: string;
  timestamp: number;
  action: "allow" | "deny" | "defer";
  allowed: boolean;
  reason: string;
  reason_codes?: string[];
}

export interface DevLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  stack_trace?: string;
  metadata?: string;
  source?: string;
}

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: unknown;
}

export interface PreferenceRecord {
  key: string;
  value: unknown;
  updatedAt: number;
  isDefault?: boolean;
}

export interface KnowledgeRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  content: string;
  sourceSemanticId?: string | null;
  tags: string[];
  metadata?: unknown;
}

export interface AnalyticsDashboardResponse {
  generatedAt: number;
  days: Array<{
    date: string;
    episodicCount: number;
    semanticCount: number;
    userMessages: number;
    assistantMessages: number;
  }>;
  summary: Array<{
    range: "24h" | "7d" | "30d";
    episodicCount: number;
    semanticCount: number;
    userMessages: number;
    assistantMessages: number;
  }>;
  topics: Array<{ term: string; count: number }>;
  aiUsage: {
    assistantMessages30d: number;
    avgAssistantChars30d: number;
  };
}

export type RelationshipKind = "episodic" | "semantic" | "knowledge" | "policy";

export type RelationshipType =
  | "EVIDENCE_FOR"
  | "INTERPRETS"
  | "REFINES"
  | "CONFLICTS_WITH"
  | "SUPERSEDES";

export interface RelationshipRecord {
  id: string;
  createdAt: number;
  createdBy: "user" | "system";
  type: RelationshipType;
  fromKind: RelationshipKind;
  fromId: string;
  toKind: RelationshipKind;
  toId: string;
  rationale: string;
  confidence?: number | null;
  evidence?: string[];
  fromContent?: string | null;
  toContent?: string | null;
}

export type InsightsSummaryResponse =
  | {
      success: true;
      status: "completed";
      summary: string;
      sources: Array<
        | { type: "semantic"; id: string; score?: number }
        | { type: "episodic"; id: string }
      >;
    }
  | {
      success: true;
      status: "queued";
      jobId: string;
      sources: Array<
        | { type: "semantic"; id: string; score?: number }
        | { type: "episodic"; id: string }
      >;
    };

export type EpisodicUpdatePatch = {
  content?: string;
  tags?: string[];
  importance?: number;
};

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  opts?: { friendlyName?: string },
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();

  try {
    const res = await fetch(url, normalizeRequestInit(init));
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      logApiError({
        url,
        method,
        status: res.status,
        message: opts?.friendlyName
          ? `${opts.friendlyName} failed (${res.status})`
          : `Request failed (${res.status})`,
        responseBody: bodyText,
      });

      // Try JSON error first for display.
      try {
        const errJson = JSON.parse(bodyText) as { error?: string };
        throw new Error(errJson.error || res.statusText);
      } catch {
        throw new Error(bodyText || res.statusText);
      }
    }

    return (await res.json()) as T;
  } catch (e: unknown) {
    // Network errors / CORS / DNS
    const msg = e instanceof Error ? e.message : String(e);
    logApiError({
      url,
      method,
      message: opts?.friendlyName
        ? `${opts.friendlyName} failed`
        : "Request failed",
      responseBody: msg,
    });
    throw e instanceof Error ? e : new Error(msg);
  }
}

export const api = {
  analytics: {
    dashboard: async (
      days: number = 30,
    ): Promise<AnalyticsDashboardResponse> => {
      return fetchJson(
        `${API_BASE_URL}/v1/analytics?days=${encodeURIComponent(String(days))}`,
        { headers },
        { friendlyName: "Fetch analytics" },
      );
    },
  },
  preferences: {
    get: async (key: string): Promise<PreferenceRecord> => {
      return fetchJson(
        `${API_BASE_URL}/v1/preferences/${encodeURIComponent(key)}`,
        { headers },
        { friendlyName: `Get preference ${key}` },
      );
    },
    set: async (key: string, value: unknown): Promise<PreferenceRecord> => {
      return fetchJson(
        `${API_BASE_URL}/v1/preferences/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ value }),
        },
        { friendlyName: `Set preference ${key}` },
      );
    },
  },
  conversations: {
    list: async (limit = 50, since = 0): Promise<ConversationRecord[]> => {
      return fetchJson(
        `${API_BASE_URL}/v1/conversations?limit=${limit}&since=${since}`,
        { headers },
        { friendlyName: "Fetch conversations" },
      );
    },
    create: async (title?: string): Promise<ConversationRecord> => {
      return fetchJson(
        `${API_BASE_URL}/v1/conversations`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ title }),
        },
        { friendlyName: "Create conversation" },
      );
    },
    rename: async (
      id: string,
      title: string,
    ): Promise<{ success: boolean; id: string; title: string }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/conversations/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ title }),
        },
        { friendlyName: "Rename conversation" },
      );
    },
    delete: async (id: string): Promise<{ success: boolean; id: string }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/conversations/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers,
        },
        { friendlyName: "Delete conversation" },
      );
    },
  },
  episodic: {
    list: async (
      limit = 50,
      opts?: { since?: number; conversationId?: string },
    ): Promise<EpisodicRecord[]> => {
      const since = opts?.since ?? 0;
      const conversationId = opts?.conversationId;
      const conversationQuery = conversationId
        ? `&conversation_id=${encodeURIComponent(conversationId)}`
        : "";
      return fetchJson(
        `${API_BASE_URL}/v1/episodic?limit=${limit}&since=${since}${conversationQuery}`,
        { headers },
        {
          friendlyName: "Fetch episodic",
        },
      );
    },
    create: async (
      content: string,
      provenance: Record<string, unknown>,
      extras?: { conversation_id?: string },
    ): Promise<{ success: boolean; id: string; receipt: unknown }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/episodic`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content, provenance, ...extras }),
        },
        { friendlyName: "Create episodic" },
      );
    },
    update: async (
      id: string,
      contentOrPatch: string | EpisodicUpdatePatch,
    ): Promise<{ success: boolean; id: string; status: string }> => {
      const body: EpisodicUpdatePatch =
        typeof contentOrPatch === "string"
          ? { content: contentOrPatch }
          : contentOrPatch;

      return fetchJson(
        `${API_BASE_URL}/v1/episodic/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        },
        { friendlyName: "Update episodic" },
      );
    },
    clear: async (): Promise<{ success: boolean; cleared?: number }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/episodic?confirm=true`,
        {
          method: "DELETE",
          headers,
        },
        { friendlyName: "Clear episodic" },
      );
    },
  },
  semantic: {
    create: async (
      content: string,
      references: string[],
      provenance: Record<string, unknown>,
    ): Promise<{ success: boolean; id: string; receipt: unknown }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/semantic`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content, references, provenance }),
        },
        { friendlyName: "Create semantic" },
      );
    },
    search: async (
      query: string,
      limit = 5,
    ): Promise<
      Array<{
        id: string;
        content: string;
        score: number;
        createdAt: number;
        provenance: Record<string, unknown>;
        references: string[];
      }>
    > => {
      return fetchJson(
        `${API_BASE_URL}/v1/semantic/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        { headers },
        { friendlyName: "Semantic search" },
      );
    },
    summarize: async (
      contents: string[],
      query?: string,
    ): Promise<{ summary: string }> => {
      return fetchJson(`${API_BASE_URL}/v1/semantic/summarize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contents, query }),
      });
    },
  },
  jobs: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: async (id: string): Promise<any> => {
      // Type 'Job' properly if possible, for now returning any
      return fetchJson(`${API_BASE_URL}/v1/jobs/${id}`, {
        method: "GET",
        headers,
      });
    },
  },
  chat: {
    send: async (
      message: string,
      history?: Array<{ role: "user" | "assistant"; content: string }>,
      conversationId?: string,
    ): Promise<{ id: string; response: string; timestamp: number }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message,
            history,
            conversation_id: conversationId,
          }),
        },
        { friendlyName: "Chat completion" },
      );
    },
    export: async (html: string): Promise<Blob> => {
      const res = await fetch(
        `${API_BASE_URL}/v1/chat/export`,
        normalizeRequestInit({
          method: "POST",
          headers,
          body: JSON.stringify({ html }),
        }),
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Export failed");
      }

      return res.blob();
    },
    /**
     * Stream chat response tokens via SSE
     * @param message - User message
     * @param history - Chat history
     * @param onToken - Callback invoked for each token received
     * @param onDone - Callback invoked when stream completes
     */
    stream: async (
      message: string,
      history: Array<{ role: "user" | "assistant"; content: string }> = [],
      conversationId: string | undefined,
      onToken: (token: string) => void,
      onMeta?: (meta: { derived_from?: string[] }) => void,
      onDone?: () => void,
    ): Promise<void> => {
      const response = await fetch(
        `${API_BASE_URL}/v1/chat/stream`,
        normalizeRequestInit({
          method: "POST",
          headers,
          body: JSON.stringify({
            message,
            history,
            conversation_id: conversationId,
          }),
        }),
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Streaming failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("ReadableStream not supported");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let reading = true;

      while (reading) {
        const { done, value } = await reader.read();
        if (done) {
          reading = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onDone?.();
              return;
            }
            try {
              const parsed = JSON.parse(data) as {
                token?: string;
                meta?: { derived_from?: string[] };
              };
              if (parsed.token) {
                onToken(parsed.token);
              }
              if (parsed.meta) {
                onMeta?.(parsed.meta);
              }
            } catch {
              // Ignore parse errors for malformed lines
            }
          }
        }
      }

      onDone?.();
    },
    /**
     * Analyze an image using vision AI
     * @param imageBlob - Image file blob
     * @param prompt - Optional prompt for specific analysis
     * @returns Analysis result
     */
    analyze: async (
      imageBlob: Blob,
      prompt?: string,
    ): Promise<{ success: boolean; analysis: string; timestamp: number }> => {
      const formData = new FormData();
      formData.append("image", imageBlob);
      if (prompt) {
        formData.append("prompt", prompt);
      }

      const res = await fetch(
        `${API_BASE_URL}/v1/chat/analyze`,
        normalizeRequestInit({
          method: "POST",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
          body: formData,
        }),
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Image analysis failed");
      }

      return res.json();
    },
    voice: async (
      audioBlob: Blob,
    ): Promise<{
      userText: string;
      assistantText: string;
      audio: string;
      episodicId: string;
      useFrontendTts: boolean;
      source: "workers-ai" | "gemini";
    }> => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch(
        `${API_BASE_URL}/v1/voice-chat`,
        normalizeRequestInit({
          method: "POST",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
          body: formData,
        }),
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Voice chat failed");
      }

      return res.json();
    },
  },
  identity: {
    list: async (): Promise<IdentityRecord[]> => {
      return fetchJson(
        `${API_BASE_URL}/v1/identity`,
        { headers },
        {
          friendlyName: "Fetch identity",
        },
      );
    },
    create: async (
      key: string,
      value: unknown,
      provenance: {
        source_type: string;
        source_id: string;
        timestamp: number;
        confidence: number;
      },
      extras?: {
        preferred_tone?: string;
        memory_retention_days?: number;
        interface_theme?: string;
      },
    ): Promise<{ success: boolean; id: string }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/identity`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            key,
            value,
            provenance,
            explicit_confirm: true,
            ...extras,
          }),
        },
        { friendlyName: "Create identity" },
      );
    },
  },
  receipts: {
    list: (limit = 50, since = 0) =>
      fetchJson<ReceiptRecord[]>(
        `${API_BASE_URL}/v1/receipts?limit=${limit}&since=${since}`,
        { headers },
        { friendlyName: "Fetch receipts" },
      ),
  },
  media: {
    upload: async (file: File): Promise<{ success: boolean; key: string }> => {
      const key = `${Date.now()}-${file.name}`;

      const res = await fetch(
        `${API_BASE_URL}/v1/media/${key}`,
        normalizeRequestInit({
          method: "PUT",
          headers: {
            Accept: "application/json",
            ...authHeaders,
          },
          body: file,
        }),
      );

      if (!res.ok) {
        throw new Error("Upload failed");
      }
      return res.json();
    },
    getUrl: (key: string) => `${API_BASE_URL}/v1/media/${key}`,
  },
  logs: {
    list: async (limit = 100): Promise<DevLog[]> => {
      return fetchJson(
        `${API_BASE_URL}/v1/logs?limit=${limit}`,
        { headers },
        { friendlyName: "Fetch logs" },
      );
    },
    clear: async (): Promise<{ success: boolean; deleted: number }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/logs`,
        { method: "DELETE", headers },
        { friendlyName: "Clear logs" },
      );
    },
  },
  knowledge: {
    list: async (
      limit = 50,
      since = 0,
      q?: string,
    ): Promise<KnowledgeRecord[]> => {
      const qs = new URLSearchParams({
        limit: String(limit),
        since: String(since),
      });
      if (q) qs.set("q", q);

      return fetchJson(
        `${API_BASE_URL}/v1/knowledge?${qs.toString()}`,
        { headers },
        { friendlyName: "Fetch knowledge" },
      );
    },
    promote: async (
      semanticId: string,
    ): Promise<{ success: boolean; record: KnowledgeRecord }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/knowledge/promote`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ semantic_id: semanticId }),
        },
        { friendlyName: "Promote knowledge" },
      );
    },
  },
  insights: {
    summarize: async (query?: string): Promise<InsightsSummaryResponse> => {
      return fetchJson(
        `${API_BASE_URL}/v1/insights/summary`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ query }),
        },
        { friendlyName: "Generate insights" },
      );
    },
  },
  relationships: {
    list: async (opts: {
      kind: RelationshipKind;
      id: string;
      limit?: number;
      since?: number;
    }): Promise<RelationshipRecord[]> => {
      const qs = new URLSearchParams({
        kind: opts.kind,
        id: opts.id,
        limit: String(opts.limit ?? 50),
        since: String(opts.since ?? 0),
      });

      return fetchJson(
        `${API_BASE_URL}/v1/relationships?${qs.toString()}`,
        { headers },
        { friendlyName: "Fetch relationships" },
      );
    },
    create: async (body: {
      type: RelationshipType;
      from_kind: RelationshipKind;
      from_id: string;
      to_kind: RelationshipKind;
      to_id: string;
      rationale: string;
      created_by?: "user" | "system";
      confidence?: number;
      evidence?: string[];
    }): Promise<{ success: true; relationship: RelationshipRecord }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/relationships`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
        { friendlyName: "Create relationship" },
      );
    },
  },
};
