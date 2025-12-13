import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Clock, Loader2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { clsx } from "clsx";

export function Memory() {
  const [activeTab, setActiveTab] = useState<"identity" | "episodic">(
    "identity",
  );

  const identityQuery = useQuery({
    queryKey: ["identity"],
    queryFn: () => api.identity.list(),
  });

  const episodicQuery = useQuery({
    queryKey: ["episodic"],
    queryFn: () => api.episodic.list(50),
  });

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Memory Store</h1>
        <p className="text-gray-400 text-sm">
          Raw access to long-term memory records
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("identity")}
          className={clsx(
            "px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
            activeTab === "identity"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-gray-200",
          )}
        >
          <User className="w-4 h-4" />
          Identity
        </button>
        <button
          onClick={() => setActiveTab("episodic")}
          className={clsx(
            "px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
            activeTab === "episodic"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-gray-200",
          )}
        >
          <Clock className="w-4 h-4" />
          Episodic Log
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "identity" && (
          <div className="space-y-4">
            {identityQuery.isLoading ? (
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            ) : identityQuery.error ? (
              <div className="text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Error: {identityQuery.error.message}
              </div>
            ) : identityQuery.data?.length === 0 ? (
              <p className="text-gray-500 italic">No identity records found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {identityQuery.data?.map((record) => (
                  <div
                    key={record.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-emerald-400 text-sm">
                        {record.key}
                      </span>
                      <span className="text-xs text-gray-500">
                        {record.last_verified
                          ? new Date(record.last_verified).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                    <div className="text-gray-200 font-medium">
                      {String(record.value)}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500 font-mono">
                      ID: {record.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "episodic" && (
          <div className="space-y-2">
            {episodicQuery.isLoading ? (
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            ) : episodicQuery.error ? (
              <div className="text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Error: {episodicQuery.error.message}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/50 text-gray-400">
                    <tr>
                      <th className="p-3 font-medium">Time</th>
                      <th className="p-3 font-medium">Content</th>
                      <th className="p-3 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {episodicQuery.data?.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-700/20">
                        <td className="p-3 text-gray-500 font-mono whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-gray-200">{record.content}</td>
                        <td className="p-3 text-gray-400">
                          {record.provenance.source_type}:
                          {record.provenance.source_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
