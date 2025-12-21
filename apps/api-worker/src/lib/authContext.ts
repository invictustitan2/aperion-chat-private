import { computeHash } from "@aperion/shared";
import { base64ToBytes, utf8ToBytes } from "./base64";
import type { Env } from "../types";

export type AuthMode = "access" | "hybrid" | "token";
export type AuthMethod = "access-jwt" | "service-token" | "legacy-token";
export type PrincipalType = "email" | "service";

export type AuthContext =
  | {
      authenticated: true;
      mode: AuthMode;
      method: AuthMethod;
      principalType: PrincipalType;
      principalId: string;
      userId: string;
      email?: string;
    }
  | {
      authenticated: false;
      mode: AuthMode;
      reason: string;
      status: 401 | 403 | 500;
    };

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  sub?: string;
  email?: string;
  [key: string]: unknown;
};

type JwkWithKid = JsonWebKey & { kid?: string };

type Jwks = { keys: JwkWithKid[] };

type JwksCache = {
  fetchedAtMs: number;
  expiresAtMs: number;
  keys: JwkWithKid[];
};

const JWKS_TTL_MS_DEFAULT = 10 * 60 * 1000; // 10 minutes
const JWT_CLOCK_SKEW_SECONDS_DEFAULT = 60;

let jwksCache: JwksCache | null = null;
let jwksInflight: Promise<JwkWithKid[]> | null = null;

function getAuthMode(env: Env): AuthMode {
  const raw = (env.APERION_AUTH_MODE || "").trim().toLowerCase();
  if (raw === "access" || raw === "hybrid" || raw === "token") return raw;
  // Sensible default: if Access config exists, default to access; otherwise token.
  if (env.CF_ACCESS_TEAM_DOMAIN || env.CF_ACCESS_AUD) return "access";
  return "token";
}

function normalizeTeamDomain(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Allow env to be either full domain or the team slug.
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}.cloudflareaccess.com`;
}

function expectedIssuer(teamDomain: string): string {
  return `https://${teamDomain}`;
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const normalized = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  return base64ToBytes(padded);
}

function decodeJwtPart<T>(partB64Url: string): T {
  const bytes = base64UrlToBytes(partB64Url);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  // Minimal cookie parsing; good enough for Access cookie extraction.
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    if (k === name) return rest.join("=");
  }
  return null;
}

function getAccessAssertionToken(
  request: Request,
):
  | { token: string; source: "header" | "cookie" }
  | { token: null; source: null } {
  // Preferred: Cloudflare-provided assertion header.
  const headerToken =
    request.headers.get("CF-Access-Jwt-Assertion") ||
    request.headers.get("X-CF-Access-Jwt-Assertion");

  if (headerToken && headerToken.trim()) {
    return { token: headerToken.trim(), source: "header" };
  }

  // Fallback: Access cookie (helps some headless/edge cases).
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookieToken = getCookieValue(cookieHeader, "CF_Authorization");
    if (cookieToken && cookieToken.trim()) {
      return { token: cookieToken.trim(), source: "cookie" };
    }
  }

  return { token: null, source: null };
}

async function fetchJwks(env: Env, opts?: { forceRefresh?: boolean }) {
  const now = Date.now();
  const forceRefresh = opts?.forceRefresh === true;
  const ttlMs = env.CF_ACCESS_JWKS_TTL_MS
    ? Number(env.CF_ACCESS_JWKS_TTL_MS)
    : JWKS_TTL_MS_DEFAULT;
  const effectiveTtlMs =
    Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : JWKS_TTL_MS_DEFAULT;

  if (!forceRefresh && jwksCache && jwksCache.expiresAtMs > now) {
    return jwksCache.keys;
  }

  if (!forceRefresh && jwksInflight) {
    return jwksInflight;
  }

  const teamDomainRaw = env.CF_ACCESS_TEAM_DOMAIN;
  if (!teamDomainRaw) {
    throw new Error("Missing CF_ACCESS_TEAM_DOMAIN");
  }
  const teamDomain = normalizeTeamDomain(teamDomainRaw);
  const jwksUrl = `https://${teamDomain}/cdn-cgi/access/certs`;

  jwksInflight = (async () => {
    const res = await fetch(jwksUrl, {
      // Best-effort cache hint at the edge; primary caching is in-memory.
      cf: {
        cacheTtl: Math.ceil(effectiveTtlMs / 1000),
        cacheEverything: false,
      },
    } as RequestInit & { cf?: unknown });
    if (!res.ok) {
      throw new Error(`JWKS fetch failed (${res.status})`);
    }
    const jwks = (await res.json()) as Jwks;
    if (!jwks?.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw new Error("JWKS response missing keys");
    }

    jwksCache = {
      fetchedAtMs: now,
      expiresAtMs: now + effectiveTtlMs,
      keys: jwks.keys,
    };

    return jwks.keys;
  })();

  try {
    return await jwksInflight;
  } finally {
    jwksInflight = null;
  }
}

async function importJwkForVerify(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function audMatches(aud: JwtPayload["aud"], expected: string): boolean {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(expected);
  return aud === expected;
}

function assertJwtClaims(
  payload: JwtPayload,
  env: Env,
  nowSeconds: number,
): void {
  const teamDomainRaw = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (!teamDomainRaw || !aud) {
    throw new Error(
      "Access auth misconfigured (missing CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD)",
    );
  }
  const issExpected = expectedIssuer(normalizeTeamDomain(teamDomainRaw));
  if (payload.iss !== issExpected) {
    throw new Error("JWT issuer mismatch");
  }
  if (!audMatches(payload.aud, aud)) {
    throw new Error("JWT audience mismatch");
  }

  const skew = env.CF_ACCESS_JWT_CLOCK_SKEW_SECONDS
    ? Number(env.CF_ACCESS_JWT_CLOCK_SKEW_SECONDS)
    : JWT_CLOCK_SKEW_SECONDS_DEFAULT;
  const effectiveSkew =
    Number.isFinite(skew) && skew >= 0 ? skew : JWT_CLOCK_SKEW_SECONDS_DEFAULT;

  if (
    typeof payload.nbf === "number" &&
    nowSeconds + effectiveSkew < payload.nbf
  ) {
    throw new Error("JWT not active yet");
  }
  if (typeof payload.exp !== "number") {
    throw new Error("JWT missing exp");
  }
  if (nowSeconds - effectiveSkew >= payload.exp) {
    throw new Error("JWT expired");
  }
}

async function verifyAccessJwt(token: string, env: Env): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeJwtPart<JwtHeader>(headerB64);
  const payload = decodeJwtPart<JwtPayload>(payloadB64);

  if (header.alg !== "RS256") {
    throw new Error("Unsupported JWT alg");
  }
  if (!header.kid) {
    throw new Error("JWT missing kid");
  }

  const data = utf8ToBytes(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(sigB64);

  // TS + WebCrypto interop: ensure ArrayBuffer-backed views (avoid SharedArrayBuffer typing).
  const dataBytes = new Uint8Array(data);
  const signatureBytes = new Uint8Array(signature);

  let keys = await fetchJwks(env);
  let jwk = keys.find((k) => k.kid === header.kid) ?? null;
  if (!jwk) {
    // Rotation: refresh once if kid unknown.
    keys = await fetchJwks(env, { forceRefresh: true });
    jwk = keys.find((k) => k.kid === header.kid) ?? null;
  }
  if (!jwk) {
    throw new Error("Unknown JWT kid");
  }

  const key = await importJwkForVerify(jwk);
  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signatureBytes,
    dataBytes,
  );
  if (!ok) {
    throw new Error("JWT signature invalid");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  assertJwtClaims(payload, env, nowSeconds);
  return payload;
}

function authFingerprintFromPrincipal(principalId: string): string {
  return computeHash(principalId).slice(0, 12);
}

function userIdFromEmail(email: string): string {
  return `user_${computeHash(email.toLowerCase()).slice(0, 24)}`;
}

function getLegacyBearerToken(
  request: Request,
):
  | { token: string; source: "header" | "query" }
  | { token: null; source: null; reason?: string } {
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    if (!authHeader.startsWith("Bearer ")) {
      return {
        token: null,
        source: null,
        reason: "Invalid authentication scheme",
      };
    }
    const token = authHeader.replace("Bearer ", "");
    return { token: token, source: "header" };
  }

  // WebSocket fallback: browsers can't set Authorization header.
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    return { token: queryToken, source: "query" };
  }

  return { token: null, source: null };
}

export function getAuthFingerprintFromAuthContext(auth: AuthContext): string {
  if (!auth.authenticated) return "missing";
  return authFingerprintFromPrincipal(auth.principalId);
}

export async function getAuthContext(
  request: Request,
  env: Env,
): Promise<AuthContext> {
  const mode = getAuthMode(env);

  // Optional local service-token auth (independent of Access).
  const serviceId = request.headers.get("CF-Access-Client-Id");
  const serviceSecret = request.headers.get("CF-Access-Client-Secret");
  if (
    serviceId &&
    serviceSecret &&
    env.CF_ACCESS_SERVICE_TOKEN_ID &&
    env.CF_ACCESS_SERVICE_TOKEN_SECRET &&
    serviceId === env.CF_ACCESS_SERVICE_TOKEN_ID &&
    serviceSecret === env.CF_ACCESS_SERVICE_TOKEN_SECRET
  ) {
    const principalId = `service:${serviceId}`;
    return {
      authenticated: true,
      mode,
      method: "service-token",
      principalType: "service",
      principalId,
      userId: principalId,
    };
  }

  // Preferred: Cloudflare Access identity via JWT assertion.
  const accessToken = getAccessAssertionToken(request);
  if (accessToken.token) {
    try {
      const payload = await verifyAccessJwt(accessToken.token, env);

      const email =
        typeof payload.email === "string" ? payload.email : undefined;
      const principalId =
        email ?? (typeof payload.sub === "string" ? payload.sub : "unknown");
      const userId = email
        ? userIdFromEmail(email)
        : `sub_${computeHash(principalId).slice(0, 24)}`;

      return {
        authenticated: true,
        mode,
        method: "access-jwt",
        principalType: "email",
        principalId,
        userId,
        email,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        authenticated: false,
        mode,
        status: 401,
        reason: `Invalid Access JWT: ${message}`,
      };
    }
  }

  if (mode === "access") {
    // Fail closed in access mode.
    if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
      return {
        authenticated: false,
        mode,
        status: 500,
        reason:
          "Access auth misconfigured (missing CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD)",
      };
    }
    return {
      authenticated: false,
      mode,
      status: 401,
      reason:
        "Missing Access assertion (expected CF-Access-Jwt-Assertion header or CF_Authorization cookie)",
    };
  }

  // Legacy token auth (dev/test only; or hybrid mode).
  const legacy = getLegacyBearerToken(request);
  if (!legacy.token || legacy.token.trim() === "") {
    const detail =
      legacy.token === null && legacy.reason ? `: ${legacy.reason}` : "";
    return {
      authenticated: false,
      mode,
      status: 401,
      reason: `Unauthorized (missing bearer token)${detail}`,
    };
  }
  if (!env.API_TOKEN) {
    return {
      authenticated: false,
      mode,
      status: 500,
      reason: "Server authentication not configured (missing API_TOKEN)",
    };
  }
  if (legacy.token !== env.API_TOKEN) {
    return {
      authenticated: false,
      mode,
      status: 403,
      reason: "Forbidden (invalid credentials)",
    };
  }

  return {
    authenticated: true,
    mode,
    method: "legacy-token",
    principalType: "service",
    principalId: "legacy-token",
    userId: "legacy-token",
  };
}
