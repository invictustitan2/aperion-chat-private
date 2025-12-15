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

export interface Receipt {
  id: string;
  timestamp: number;
  action: string;
  allowed: boolean;
  reason: string;
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
    list: async (limit = 50): Promise<Receipt[]> => {
      return fetchJson(
        `${API_BASE_URL}/v1/receipts?limit=${limit}`,
        { headers },
        {
          friendlyName: "Fetch receipts",
        },
      );
    },
  },
};
