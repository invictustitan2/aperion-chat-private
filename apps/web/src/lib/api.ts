import { EpisodicRecord, IdentityRecord } from "@aperion/memory-core";
import { logApiError } from "./errorLog";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.warn("VITE_AUTH_TOKEN is missing. API calls will likely fail.");
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
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
          Authorization: `Bearer ${AUTH_TOKEN}`,
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
  dev: {
    logs: (limit = 100) =>
      fetchJson<DevLog[]>(
        `${API_BASE_URL}/api/dev/logs?limit=${limit}`,
        { headers },
        { friendlyName: "Fetch dev logs" },
      ),
    clear: () =>
      fetchJson<{ success: boolean }>(
        `${API_BASE_URL}/api/dev/logs/clear`,
        { method: "POST", headers },
        { friendlyName: "Clear dev logs" },
      ),
  },
};
