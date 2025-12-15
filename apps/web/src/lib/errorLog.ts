export type ErrorKind = "api" | "runtime" | "server";

export type ErrorEntry = {
  id: string;
  ts: number;
  kind: ErrorKind;
  message: string;
  url?: string;
  method?: string;
  status?: number;
  responseBody?: string;
  stack?: string;
};

const STORAGE_KEY = "aperion:errorLog:v1";
const MAX_ENTRIES = 200;

let entries: ErrorEntry[] = [];
const listeners = new Set<() => void>();
let handlersInstalled = false;

function safeNow() {
  return Date.now();
}

function safeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${safeNow()}-${Math.random().toString(16).slice(2)}`;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function loadFromStorage() {
  if (!canUseLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    entries = parsed
      .filter((e) => e && typeof e === "object")
      .slice(-MAX_ENTRIES) as ErrorEntry[];
  } catch {
    // Ignore corrupted storage.
  }
}

function persistToStorage() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_ENTRIES)),
    );
  } catch {
    // Ignore quota/permissions.
  }
}

function emit() {
  for (const l of listeners) l();
}

function toMessage(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message || "Error", stack: err.stack };
  }
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

export function getErrorEntries(): ErrorEntry[] {
  if (entries.length === 0) loadFromStorage();
  return [...entries].sort((a, b) => b.ts - a.ts);
}

export function clearErrorEntries() {
  entries = [];
  persistToStorage();
  emit();
}

export function subscribeToErrorLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function logRuntimeError(err: unknown) {
  const { message, stack } = toMessage(err);
  const entry: ErrorEntry = {
    id: safeId(),
    ts: safeNow(),
    kind: "runtime",
    message,
    stack,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persistToStorage();
  emit();
}

export function logApiError(input: {
  url: string;
  method?: string;
  status?: number;
  message: string;
  responseBody?: string;
}) {
  const entry: ErrorEntry = {
    id: safeId(),
    ts: safeNow(),
    kind: "api",
    message: input.message,
    url: input.url,
    method: input.method,
    status: input.status,
    responseBody: input.responseBody,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persistToStorage();
  emit();
}

export function installGlobalErrorHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  if (typeof window === "undefined") return;

  loadFromStorage();

  window.addEventListener("error", (event) => {
    // event.error is not always populated (cross-origin script errors, etc.)
    if (event.error) {
      logRuntimeError(event.error);
    } else {
      logRuntimeError(event.message);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    logRuntimeError(event.reason);
  });
}
