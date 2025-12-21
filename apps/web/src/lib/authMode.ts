type WebAuthMode = "access" | "token" | "hybrid";

function getMode(): string {
  return (import.meta.env.MODE || "production").toLowerCase();
}

export function isTestMode(): boolean {
  return getMode() === "test";
}

export function isProdBuild(): boolean {
  return import.meta.env.PROD;
}

export function isDevRuntime(): boolean {
  // In Vite, test runs often present as DEV=true; treat MODE=test specially.
  return import.meta.env.DEV && !isTestMode();
}

export function getWebAuthMode(): WebAuthMode {
  const explicit = (import.meta.env.VITE_AUTH_MODE || "").toLowerCase();
  if (explicit === "access" || explicit === "token" || explicit === "hybrid") {
    // NOTE: web UI no longer supports token-mode auth in shipped code.
    // Treat any explicit token/hybrid request as access to avoid browser secrets.
    return explicit === "access" ? "access" : "access";
  }
  // Safe defaults: prod/test behaves like access; dev can use token if present.
  return "access";
}

export function getDevAuthToken(): string | undefined {
  // Intentionally disabled: the browser must not rely on a bearer token.
  return undefined;
}

export function shouldSendBearerToken(): boolean {
  return false;
}

export function shouldAppendWebSocketToken(): boolean {
  // Same as HTTP token usage.
  return shouldSendBearerToken();
}

export function shouldShowDevDebugUi(): boolean {
  // Explicitly avoid rendering debug blocks in test/prod.
  return isDevRuntime();
}
