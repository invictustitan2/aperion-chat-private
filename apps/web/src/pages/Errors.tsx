import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  Bug,
  Globe,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
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

export function Errors() {
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<"all" | "client" | "server">("all");
  const queryClient = useQueryClient();

  // 1. Client Logs
  useEffect(() => {
    return subscribeToErrorLog(() => setVersion((v) => v + 1));
  }, []);

  const clientLogs = useMemo(() => {
    void version;
    return getErrorEntries();
  }, [version]);

  // 2. Server Logs
  const serverQuery = useQuery({
    queryKey: ["dev-logs"],
    queryFn: () => api.dev.logs(100),
    refetchInterval: 5000, // Live polling
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      clearErrorEntries();
      await api.dev.clear();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-logs"] });
    },
  });

  // 3. Merge
  const allLogs: DisplayEntry[] = useMemo(() => {
    const serverEntries: DisplayEntry[] = (serverQuery.data || []).map((l) => ({
      id: l.id,
      ts: l.timestamp,
      kind: "server",
      message: l.message,
      stack: l.stack_trace,
      level: l.level,
    }));

    return [...clientLogs, ...serverEntries].sort((a, b) => b.ts - a.ts);
  }, [clientLogs, serverQuery.data]);

  const filteredLogs = allLogs.filter((l) => {
    if (filter === "client") return l.kind !== "server";
    if (filter === "server") return l.kind === "server";
    return true;
  });

  const apiCount = allLogs.filter((e) => e.kind === "api").length;
  const runtimeCount = allLogs.filter((e) => e.kind === "runtime").length;
  const serverCount = allLogs.filter((e) => e.kind === "server").length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Debug Console</h1>
          <p className="text-gray-400 text-sm">
            Unified log of client application and server worker errors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => serverQuery.refetch()}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw
              className={clsx(
                "w-4 h-4",
                serverQuery.isFetching && "animate-spin",
              )}
            />
          </button>
          <button
            onClick={() => clearMutation.mutate()}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
              allLogs.length
                ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700/60"
                : "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed",
            )}
            disabled={!allLogs.length || clearMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
            {clearMutation.isPending ? "Clearing..." : "Clear All"}
          </button>
        </div>
      </header>

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
            {allLogs.length}
          </div>
        </button>

        <button
          onClick={() => setFilter("server")}
          className={clsx(
            "text-left bg-gray-800 border rounded-lg px-4 py-3 transition-colors",
            filter === "server"
              ? "border-blue-500/50 ring-1 ring-blue-500/20"
              : "border-gray-700 hover:border-gray-600",
          )}
        >
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            Server
          </div>
          <div className="text-blue-400 font-mono mt-1 text-lg">
            {serverCount}
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

        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 opacity-75">
          <div className="text-gray-500 text-xs uppercase tracking-wider">
            API Network
          </div>
          <div className="text-emerald-500 font-mono mt-1 text-lg">
            {apiCount}
          </div>
        </div>
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
