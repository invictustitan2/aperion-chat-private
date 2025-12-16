import { Env } from "../types";

export interface PreferenceRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class PreferencesService {
  constructor(private env: Env) {}

  async get(key: string): Promise<PreferenceRecord | null> {
    if (!key) throw new Error("Missing key");

    const row = await this.env.MEMORY_DB.prepare(
      "SELECT key, value, updated_at FROM preferences WHERE key = ?",
    )
      .bind(key)
      .first();

    if (!row) return null;

    const r = row as Record<string, unknown>;
    return {
      key: String(r.key),
      value: JSON.parse(String(r.value)),
      updatedAt: Number(r.updated_at),
    };
  }

  async set(key: string, value: unknown): Promise<PreferenceRecord> {
    if (!key) throw new Error("Missing key");

    const now = Date.now();
    const valueText = JSON.stringify(value);

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
      .bind(key, valueText, now)
      .run();

    return { key, value, updatedAt: now };
  }
}
