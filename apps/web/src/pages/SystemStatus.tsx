import { clsx } from "clsx";
import {
  AlertCircle,
  Bug,
  ExternalLink,
  Globe,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clearErrorEntries,
  getErrorEntries,
  subscribeToErrorLog,
  type ErrorEntry,
} from "../lib/errorLog";

// Extended entry type for display
type DisplayEntry = ErrorEntry & {
  level?: string;
};

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function EntryRow({ entry }: { entry: DisplayEntry }) {
  let Icon = Bug;
  let colorClass = "text-red-400";

  if (entry.kind === "api") {
    Icon = Globe;
    colorClass = "text-emerald-500";
  } else if (entry.kind === "server") {
    Icon = Server;
    colorClass = "text-blue-400";
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className={clsx("w-5 h-5 mt-0.5 shrink-0", colorClass)} />
          <div className="min-w-0">
            <div className="text-sm text-gray-200 break-words font-medium">
              {entry.level ? `[${entry.level}] ` : ""}
              {entry.message}
            </div>
            <div className="text-xs text-gray-500 font-mono mt-1">
              {formatTs(entry.ts)} • {entry.kind}
              {entry.status ? ` • ${entry.status}` : ""}
            </div>
          </div>
        </div>
      </div>

      {(entry.url || entry.method) && (
        <div className="text-xs font-mono text-gray-400 break-all bg-gray-900/30 p-1 rounded">
          {entry.method ? `${entry.method} ` : ""}
          {entry.url ?? ""}
        </div>
      )}

      {entry.responseBody && (
        <pre className="text-xs text-gray-300 bg-gray-900/40 border border-gray-700/50 rounded p-3 overflow-auto max-h-40">
          {entry.responseBody}
        </pre>
      )}

      {entry.stack && (
        <pre className="text-xs text-gray-400 bg-gray-900/40 border border-gray-700/50 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap">
          {entry.stack}
        </pre>
      )}
    </div>
  );
}

export function SystemStatus() {
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<"all" | "client" | "api">("all");

  // Client Logs Subscription
  useEffect(() => {
    return subscribeToErrorLog(() => setVersion((v) => v + 1));
  }, []);

  const logs = useMemo(() => {
    void version;
    return getErrorEntries().sort((a, b) => b.ts - a.ts);
  }, [version]);

  const filteredLogs = logs.filter((l) => {
    if (filter === "client") return l.kind === "runtime";
    if (filter === "api") return l.kind === "api";
    return true;
  });

  const apiCount = logs.filter((e) => e.kind === "api").length;
  const runtimeCount = logs.filter((e) => e.kind === "runtime").length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Status</h1>
          <p className="text-gray-400 text-sm">
            Client-side error logs and API status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVersion((v) => v + 1)}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              clearErrorEntries();
              setVersion((v) => v + 1);
            }}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
              logs.length
                ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700/60"
                : "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed",
            )}
            disabled={!logs.length}
          >
            <Trash2 className="w-4 h-4" />
            Clear Client Logs
          </button>
        </div>
      </header>

      {/* Cloudflare Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Server className="w-5 h-5 text-blue-400 mt-0.5 sm:mt-0" />
          <div>
            <h3 className="text-blue-400 font-medium text-sm">
              Server Logs (Workers Observability)
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              Backend logs are streamed directly to Cloudflare. Use the
              dashboard to view real-time server errors and traces.
            </p>
          </div>
        </div>
        <a
          href="https://dash.cloudflare.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Open Dashboard
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Tabs / Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <button
          onClick={() => setFilter("all")}
          className={clsx(
            "text-left bg-gray-800 border rounded-lg px-4 py-3 transition-colors",
            filter === "all"
              ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
              : "border-gray-700 hover:border-gray-600",
          )}
        >
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            Total Events
          </div>
          <div className="text-gray-200 font-mono mt-1 text-lg">
            {logs.length}
          </div>
        </button>

        <button
          onClick={() => setFilter("client")}
          className={clsx(
            "text-left bg-gray-800 border rounded-lg px-4 py-3 transition-colors",
            filter === "client"
              ? "border-red-500/50 ring-1 ring-red-500/20"
              : "border-gray-700 hover:border-gray-600",
          )}
        >
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            Client Runtime
          </div>
          <div className="text-red-400 font-mono mt-1 text-lg">
            {runtimeCount}
          </div>
        </button>

        <button
          onClick={() => setFilter("api")}
          className={clsx(
            "text-left bg-gray-800 border rounded-lg px-4 py-3 transition-colors",
            filter === "api"
              ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
              : "border-gray-700 hover:border-gray-600",
          )}
        >
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            API Network
          </div>
          <div className="text-emerald-500 font-mono mt-1 text-lg">
            {apiCount}
          </div>
        </button>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="p-8 flex flex-col items-center justify-center bg-gray-800/30 border border-gray-700/50 rounded-xl text-gray-400 gap-4">
          <div className="p-4 bg-gray-800 rounded-full">
            <AlertCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <span>No logs found for this filter.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
