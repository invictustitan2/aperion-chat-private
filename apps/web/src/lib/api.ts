import { EpisodicRecord, IdentityRecord } from '@aperion/memory-core';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787';
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.warn('VITE_AUTH_TOKEN is missing. API calls will likely fail.');
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

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
      const res = await fetch(`${API_BASE_URL}/v1/episodic?limit=${limit}`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch episodic memory: ${res.statusText}`);
      return res.json();
    },
    create: async (content: string, provenance: any): Promise<any> => {
      const res = await fetch(`${API_BASE_URL}/v1/episodic`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, provenance }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to create episodic memory');
      }
      return res.json();
    },
  },
  semantic: {
    create: async (content: string, references: string[], provenance: any): Promise<any> => {
      const res = await fetch(`${API_BASE_URL}/v1/semantic`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, references, provenance }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to create semantic memory');
      }
      return res.json();
    },
  },
  identity: {
    list: async (): Promise<IdentityRecord[]> => {
      const res = await fetch(`${API_BASE_URL}/v1/identity`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch identity memory: ${res.statusText}`);
      return res.json();
    },
  },
  receipts: {
    list: async (limit = 50): Promise<Receipt[]> => {
      const res = await fetch(`${API_BASE_URL}/v1/receipts?limit=${limit}`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch receipts: ${res.statusText}`);
      return res.json();
    },
  },
};
