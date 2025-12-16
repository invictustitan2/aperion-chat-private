import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Activity,
  CheckCircle,
  Info,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export function Settings() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") !== "light";
    }
    return true;
  });

  // API Health Check
  const healthCheck = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const start = performance.now();
      try {
        await api.episodic.list(1);
        return { ok: true, latency: Math.round(performance.now() - start) };
      } catch {
        return { ok: false, latency: 0 };
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  const authToken = import.meta.env.VITE_AUTH_TOKEN as string | undefined;
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787",
    [],
  );
  const authPreview = useMemo(() => {
    if (!authToken) return "Not configured";
    if (authToken.length <= 12) return authToken;
    return `${authToken.slice(0, 6)}…${authToken.slice(-4)}`;
  }, [authToken]);

  const [authCheck, setAuthCheck] = useState<
    | { status: "idle" }
    | { status: "running" }
    | { status: "ok"; latency: number; detail: string }
    | { status: "error"; detail: string }
  >({ status: "idle" });

  const runAuthCheck = async () => {
    setAuthCheck({ status: "running" });
    const start = performance.now();
    try {
      const identities = await api.identity.list();
      setAuthCheck({
        status: "ok",
        latency: Math.round(performance.now() - start),
        detail: `Received ${identities.length} identity record(s)`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthCheck({ status: "error", detail: message });
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure application preferences</p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* API Status */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-500" />
            API Status
          </h2>
          <div className="flex items-center gap-4">
            <div
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                healthCheck.data?.ok
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400",
              )}
            >
              {healthCheck.data?.ok ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="font-medium">
                {healthCheck.isLoading
                  ? "Checking..."
                  : healthCheck.data?.ok
                    ? "Connected"
                    : "Disconnected"}
              </span>
            </div>
            {healthCheck.data?.ok && (
              <span className="text-gray-500 text-sm">
                Latency: {healthCheck.data.latency}ms
              </span>
            )}
          </div>
        </section>

        {/* Theme Toggle */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-gray-500">
                Switch between dark and light mode
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={clsx(
                "relative inline-flex h-10 w-20 items-center rounded-full transition-colors",
                isDark ? "bg-gray-700" : "bg-yellow-100",
              )}
            >
              <span
                className={clsx(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg transform transition-transform",
                  isDark ? "translate-x-10" : "translate-x-1",
                )}
              >
                {isDark ? (
                  <Moon className="w-4 h-4 text-gray-700" />
                ) : (
                  <Sun className="w-4 h-4 text-yellow-500" />
                )}
              </span>
            </button>
          </div>
        </section>

        {/* Auth Debugging */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {authCheck.status === "ok" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ) : authCheck.status === "error" ? (
              <ShieldAlert className="w-5 h-5 text-red-500" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-yellow-500" />
            )}
            Authentication Debug
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">API Base URL</span>
              <span className="font-mono text-xs truncate max-w-[200px] text-gray-200">
                {apiBaseUrl}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Auth Token</span>
              <span className="font-mono text-xs truncate max-w-[200px] text-gray-200">
                {authPreview}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              onClick={runAuthCheck}
              disabled={authCheck.status === "running"}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                authCheck.status === "ok"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
                authCheck.status === "running" &&
                  "opacity-70 cursor-not-allowed",
              )}
            >
              {authCheck.status === "running"
                ? "Running check..."
                : "Run auth self-test"}
            </button>
            <div className="text-sm text-gray-400">
              {authCheck.status === "ok" && (
                <span>
                  Authentication succeeded in {authCheck.latency}ms.{" "}
                  {authCheck.detail}
                </span>
              )}
              {authCheck.status === "error" && (
                <span>
                  Auth failed: {authCheck.detail}. Confirm CORS for {apiBaseUrl}{" "}
                  and that VITE_AUTH_TOKEN matches the Worker configuration.
                </span>
              )}
              {authCheck.status === "idle" && (
                <span>
                  Run the self-test to validate your token and CORS
                  configuration.
                </span>
              )}
              {authCheck.status === "running" && (
                <span>Checking /v1/identity...</span>
              )}
            </div>
          </div>

          <ul className="text-xs text-gray-400 list-disc pl-5 space-y-1">
            <li>
              Ensure VITE_AUTH_TOKEN is set in your .env or Cloudflare Pages
              environment.
            </li>
            <li>
              VITE_API_BASE_URL should point to the Worker domain that accepts
              your origin to avoid CORS failures.
            </li>
            <li>
              Restart the dev server after updating env vars so the UI can pick
              up the new token.
            </li>
          </ul>
        </section>

        {/* Version Info */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-500" />
            About
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-mono">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Environment</span>
              <span className="font-mono">
                {import.meta.env.MODE || "production"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Endpoint</span>
              <span className="font-mono text-xs truncate max-w-[250px]">
                {import.meta.env.VITE_API_BASE_URL || "Not configured"}
              </span>
            </div>
          </div>
        </section>

        {/* Cloudflare Infrastructure */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Infrastructure</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "D1 Database", status: true },
              { name: "Vectorize", status: true },
              { name: "Workers AI", status: true },
              { name: "R2 Storage", status: true },
            ].map((item) => (
              <div
                key={item.name}
                className="bg-gray-900 rounded-lg p-3 text-center"
              >
                <div
                  className={clsx(
                    "w-3 h-3 rounded-full mx-auto mb-2",
                    item.status ? "bg-emerald-500" : "bg-red-500",
                  )}
                />
                <p className="text-xs text-gray-400">{item.name}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
