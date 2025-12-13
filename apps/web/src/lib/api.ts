const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'dev-token';

export interface EpisodicMemory {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticMemory {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface IdentityRecord {
  key: string;
  value: unknown;
  timestamp: number;
}

export interface Receipt {
  id: string;
  timestamp: number;
  action: string;
  allowed: boolean;
  reason?: string;
}

async function fetchApi(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

export const api = {
  episodic: {
    list: () => fetchApi('/v1/episodic'),
    create: (data: Omit<EpisodicMemory, 'id' | 'timestamp'>) => 
      fetchApi('/v1/episodic', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  semantic: {
    list: () => fetchApi('/v1/semantic'),
    create: (data: Omit<SemanticMemory, 'id'>) => 
      fetchApi('/v1/semantic', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  identity: {
    get: (key: string) => fetchApi(`/v1/identity?key=${key}`),
    set: (key: string, value: unknown) => 
      fetchApi('/v1/identity', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      }),
  },
  receipts: {
    list: () => fetchApi('/v1/receipts'),
  },
};

