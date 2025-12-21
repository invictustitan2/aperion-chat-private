export type KnownPreferenceKey = "ai.tone";

export type PreferenceDefault = {
  key: KnownPreferenceKey;
  value: unknown;
};

const DEFAULTS: Record<KnownPreferenceKey, unknown> = {
  "ai.tone": "default",
};

export function isKnownPreferenceKey(key: string): key is KnownPreferenceKey {
  return key === "ai.tone";
}

export function getDefaultPreference(
  key: KnownPreferenceKey,
): PreferenceDefault {
  return { key, value: DEFAULTS[key] };
}

export function validatePreferenceValue(
  key: KnownPreferenceKey,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (key) {
    case "ai.tone": {
      if (typeof value !== "string") {
        return { ok: false, error: "ai.tone must be a string" };
      }
      if (value !== "default" && value !== "concise" && value !== "detailed") {
        return {
          ok: false,
          error: "ai.tone must be one of: default, concise, detailed",
        };
      }
      return { ok: true, value };
    }
  }
}
