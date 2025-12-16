import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { api, DevLog } from "../lib/api";

const LOG_LEVELS = ["all", "error", "warn", "info", "debug"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400 bg-red-500/10 border-red-500/20",
  warn: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  info: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  debug: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const LEVEL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  error: XCircle,
  warn: AlertCircle,
  info: Info,
  debug: CheckCircle,
};

export function Logs() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<LogLevel>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Fetch logs
  const {
    data: logs,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["dev-logs"],
    queryFn: () => api.logs.list(100),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Clear logs mutation
  const clearLogs = useMutation({
    mutationFn: () => api.logs.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-logs"] });
    },
  });

  // Filter logs
  const filteredLogs = (logs || []).filter((log) => {
    // Level filter
    if (filter !== "all" && log.level !== filter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query) ||
        log.metadata?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 md:p-6 border-b border-white/10 glass-dark">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              System Logs
            </h1>
            <p className="text-gray-400 text-xs md:text-sm">
              Real-time application logs • Auto-refresh enabled
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              <RefreshCw
                className={clsx("w-4 h-4", isFetching && "animate-spin")}
              />
              Refresh
            </button>
            <button
              onClick={() => clearLogs.mutate()}
              disabled={clearLogs.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-all text-sm"
            >
              {clearLogs.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear Logs
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
            />
          </div>

          {/* Level Filter */}
          <div className="flex gap-1 bg-black/20 rounded-lg p-1 border border-white/10">
            {LOG_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={clsx(
                  "px-3 py-1 rounded-md text-sm font-medium transition-all capitalize",
                  filter === level
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5",
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Log List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400">
            <AlertCircle className="w-12 h-12 mb-4" />
            <p>Failed to load logs</p>
            <p className="text-sm text-gray-500 mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Info className="w-12 h-12 mb-4 opacity-50" />
            <p>No logs found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? "Try adjusting your search"
                : "Logs will appear here as events occur"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log: DevLog) => {
              const Icon = LEVEL_ICONS[log.level] || Info;
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className={clsx(
                    "border rounded-lg transition-all cursor-pointer",
                    LEVEL_COLORS[log.level] || LEVEL_COLORS.debug,
                    isExpanded ? "ring-2 ring-white/20" : "",
                  )}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div className="p-3 flex items-start gap-3">
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-sm truncate flex-1">
                          {log.message}
                        </span>
                        <span className="text-xs opacity-60 flex-shrink-0">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      {log.source && (
                        <span className="text-xs opacity-50 mt-1 inline-block">
                          Source: {log.source}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-current/10">
                      {log.metadata && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">
                            Metadata:
                          </p>
                          <pre className="text-xs bg-black/30 p-2 rounded overflow-auto max-h-32 font-mono">
                            {log.metadata}
                          </pre>
                        </div>
                      )}
                      {log.stack_trace && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">
                            Stack Trace:
                          </p>
                          <pre className="text-xs bg-black/30 p-2 rounded overflow-auto max-h-48 font-mono text-red-300">
                            {log.stack_trace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <footer className="p-3 border-t border-white/10 bg-black/20 text-xs text-gray-500 flex justify-between">
        <span>
          Showing {filteredLogs.length} of {logs?.length || 0} logs
        </span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}
