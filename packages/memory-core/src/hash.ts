import { createHash } from 'crypto';

/**
 * Deterministically stringifies an object by sorting keys.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }

  const keys = Object.keys(obj as object).sort();
  const parts = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    // Skip undefined values to match JSON.stringify behavior usually, 
    // but for strict hashing we might want to be explicit. 
    // JSON.stringify omits undefined properties.
    if (val === undefined) return null;
    return JSON.stringify(key) + ':' + canonicalize(val);
  }).filter(part => part !== null);

  return '{' + parts.join(',') + '}';
}

/**
 * Computes SHA-256 hash of the canonicalized input.
 */
export function computeHash(input: unknown): string {
  const str = typeof input === 'string' ? input : canonicalize(input);
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Computes a stable ID for a runbook task based on its markdown content.
 * Normalizes whitespace to ensure stability.
 */
export function hashRunbookTask(markdownText: string): string {
  // Normalize whitespace: trim and replace multiple spaces/newlines with single space
  const normalized = markdownText.trim().replace(/\s+/g, ' ');
  return computeHash(normalized);
}
