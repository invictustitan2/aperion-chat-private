import { EpisodicRecord, IdentityRecord } from "@aperion/memory-core";
import { logApiError } from "./errorLog";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;
const authHeaders: Record<string, string> = AUTH_TOKEN
  ? { Authorization: `Bearer ${AUTH_TOKEN}` }
  : {};

if (!AUTH_TOKEN) {
  console.warn(
    "VITE_AUTH_TOKEN is missing. API calls will likely fail. Add it to your .env or Cloudflare Pages env vars.",
  );
}

if (!import.meta.env.VITE_API_BASE_URL) {
  console.info(
    "VITE_API_BASE_URL is not set, defaulting to http://127.0.0.1:8787. Set it to your deployed Worker URL to avoid CORS.",
  );
}

const headers = {
  "Content-Type": "application/json",
  ...authHeaders,
};

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

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  opts?: { friendlyName?: string },
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();

  try {
    const res = await fetch(url, init);
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
  episodic: {
    list: async (limit = 50): Promise<EpisodicRecord[]> => {
      return fetchJson(
        `${API_BASE_URL}/v1/episodic?limit=${limit}`,
        { headers },
        {
          friendlyName: "Fetch episodic",
        },
      );
    },
    create: async (
      content: string,
      provenance: Record<string, unknown>,
    ): Promise<{ success: boolean; id: string; receipt: unknown }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/episodic`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content, provenance }),
        },
        { friendlyName: "Create episodic" },
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
    ): Promise<{ id: string; response: string; timestamp: number }> => {
      return fetchJson(
        `${API_BASE_URL}/v1/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ message, history }),
        },
        { friendlyName: "Chat completion" },
      );
    },
    export: async (html: string): Promise<Blob> => {
      const res = await fetch(`${API_BASE_URL}/v1/chat/export`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ html }),
      });

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
      onToken: (token: string) => void,
      onDone?: () => void,
    ): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/v1/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, history }),
      });

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
              const parsed = JSON.parse(data) as { token?: string };
              if (parsed.token) {
                onToken(parsed.token);
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

      const res = await fetch(`${API_BASE_URL}/v1/chat/analyze`, {
        method: "POST",
        headers: {
          ...authHeaders,
        },
        body: formData,
      });

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

      const res = await fetch(`${API_BASE_URL}/v1/voice-chat`, {
        method: "POST",
        headers: {
          ...authHeaders,
        },
        body: formData,
      });

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

      const res = await fetch(`${API_BASE_URL}/v1/media/${key}`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          // Content-Type might be set automatically or we set it
        },
        body: file,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }
      return res.json();
    },
    getUrl: (key: string) => `${API_BASE_URL}/v1/media/${key}`,
  },
};
