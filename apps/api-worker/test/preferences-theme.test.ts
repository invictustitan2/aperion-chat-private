import { describe, expect, it } from "vitest";
import { PreferencesController } from "../src/controllers/PreferencesController";
import { createFakeD1Database, createMockEnv } from "./bindings/mockBindings";

function makePreferenceDb() {
  const store = new Map<
    string,
    {
      key: string;
      valueText: string;
      updated_at: number;
    }
  >();

  return createFakeD1Database({
    first: async (entry) => {
      if (!/from\s+preferences\s+where\s+key\s*=\s*\?/i.test(entry.query)) {
        return null;
      }

      const key = String(entry.binds[0] ?? "");
      const row = store.get(key);
      if (!row) return null;
      return {
        key: row.key,
        value: row.valueText,
        updated_at: row.updated_at,
      };
    },
    run: async (entry) => {
      if (!/insert\s+into\s+preferences/i.test(entry.query)) {
        return { success: true, meta: {}, results: [] };
      }

      const [keyRaw, valueTextRaw, updatedAtRaw] = entry.binds;
      const key = String(keyRaw ?? "");
      const valueText = String(valueTextRaw ?? "null");
      const updated_at = Number(updatedAtRaw ?? 0);

      store.set(key, { key, valueText, updated_at });
      return { success: true, meta: {}, results: [] };
    },
  });
}

describe("Preferences: theme", () => {
  it("GET /v1/preferences/theme returns default dark when absent", async () => {
    const db = makePreferenceDb();
    const env = createMockEnv({ MEMORY_DB: db });

    const req = {
      params: { key: "theme" },
      json: async () => ({}),
    } as unknown as {
      params: { key: string };
      json: () => Promise<unknown>;
    };

    const res = await PreferencesController.get(req as never, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      key: string;
      value: unknown;
      updatedAt: number;
      isDefault: boolean;
    };

    expect(body).toMatchObject({
      key: "theme",
      value: "dark",
      isDefault: true,
    });
    expect(body.updatedAt).toBe(0);
  });

  it("PATCH /v1/preferences/theme accepts valid value and persists", async () => {
    const db = makePreferenceDb();
    const env = createMockEnv({ MEMORY_DB: db });

    const setReq = {
      params: { key: "theme" },
      json: async () => ({ value: "light" }),
    } as unknown as { params: { key: string }; json: () => Promise<unknown> };

    const setRes = await PreferencesController.set(setReq as never, env);
    expect(setRes.status).toBe(200);

    const getReq = {
      params: { key: "theme" },
      json: async () => ({}) as unknown,
    } as unknown as { params: { key: string }; json: () => Promise<unknown> };

    const getRes = await PreferencesController.get(getReq as never, env);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { key: string; value: unknown };
    expect(body).toMatchObject({ key: "theme", value: "light" });
  });

  it("PATCH /v1/preferences/theme rejects invalid values", async () => {
    const db = makePreferenceDb();
    const env = createMockEnv({ MEMORY_DB: db });

    const req = {
      params: { key: "theme" },
      json: async () => ({ value: "neon" }),
    } as unknown as { params: { key: string }; json: () => Promise<unknown> };

    const res = await PreferencesController.set(req as never, env);
    expect(res.status).toBe(400);

    const text = await res.text();
    expect(text.toLowerCase()).toContain("theme");
    expect(text.toLowerCase()).toContain("dark");
  });
});
