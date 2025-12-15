import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Trash2, Globe, Bug } from "lucide-react";
import { clsx } from "clsx";
import {
  clearErrorEntries,
  getErrorEntries,
  subscribeToErrorLog,
  type ErrorEntry,
} from "../lib/errorLog";

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function EntryRow({ entry }: { entry: ErrorEntry }) {
  const Icon = entry.kind === "api" ? Globe : Bug;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon
            className={clsx(
              "w-5 h-5 mt-0.5 shrink-0",
              entry.kind === "api" ? "text-emerald-500" : "text-red-400",
            )}
          />
          <div className="min-w-0">
            <div className="text-sm text-gray-200 break-words">
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
        <div className="text-xs font-mono text-gray-400 break-all">
          {entry.method ? `${entry.method} ` : ""}
          {entry.url ?? ""}
        </div>
      )}

      {entry.responseBody && (
        <pre className="text-xs text-gray-300 bg-gray-900/40 border border-gray-700/50 rounded p-3 overflow-auto">
          {entry.responseBody}
        </pre>
      )}

      {entry.stack && (
        <pre className="text-xs text-gray-300 bg-gray-900/40 border border-gray-700/50 rounded p-3 overflow-auto">
          {entry.stack}
        </pre>
      )}
    </div>
  );
}

export function Errors() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribeToErrorLog(() => setVersion((v) => v + 1));
  }, []);

  const items = useMemo(() => {
    void version;
    return getErrorEntries();
  }, [version]);

  const apiCount = items.filter((e) => e.kind === "api").length;
  const runtimeCount = items.filter((e) => e.kind === "runtime").length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Errors</h1>
          <p className="text-gray-400 text-sm">
            Debuggable log of API failures and runtime errors
          </p>
        </div>

        <button
          onClick={() => clearErrorEntries()}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
            items.length
              ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700/60"
              : "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed",
          )}
          disabled={!items.length}
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </header>

      <div className="flex gap-4 text-sm">
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            Total
          </div>
          <div className="text-gray-200 font-mono mt-1">{items.length}</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            API
          </div>
          <div className="text-emerald-400 font-mono mt-1">{apiCount}</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <div className="text-gray-400 text-xs uppercase tracking-wider">
            Runtime
          </div>
          <div className="text-red-300 font-mono mt-1">{runtimeCount}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-emerald-500" />
          <span>No errors recorded in this browser yet.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
