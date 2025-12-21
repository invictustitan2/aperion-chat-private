export type Env = Cloudflare.Env & {
  // Auth
  APERION_AUTH_MODE?: "access" | "hybrid" | "token";
  // Auth observability (optional; defaults to low-noise deny-only)
  APERION_AUTH_LOG_OUTCOMES?: "deny" | "all";
  API_TOKEN?: string;

  // Cloudflare Access (Zero Trust)
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_JWKS_TTL_MS?: string;
  CF_ACCESS_JWT_CLOCK_SKEW_SECONDS?: string;
  CF_ACCESS_SERVICE_TOKEN_ID?: string;
  CF_ACCESS_SERVICE_TOKEN_SECRET?: string;

  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};
