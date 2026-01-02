export type KnownPreferenceKey = "ai.tone" | "theme";

export type PreferenceDefault = {
  key: KnownPreferenceKey;
  value: unknown;
};

const DEFAULTS: Record<KnownPreferenceKey, unknown> = {
  "ai.tone": "default",
  theme: "dark",
};

export function isKnownPreferenceKey(key: string): key is KnownPreferenceKey {
  return key === "ai.tone" || key === "theme";
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

    case "theme": {
      if (typeof value !== "string") {
        return { ok: false, error: "theme must be a string" };
      }
      if (value !== "dark" && value !== "light" && value !== "system") {
        return {
          ok: false,
          error: "theme must be one of: dark, light, system",
        };
      }
      return { ok: true, value };
    }
  }
}
