import { useMutation, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import React, { useState } from "react";
import { api } from "../lib/api";

interface SearchResult {
  id: string;
  content: string;
  score: number;
  createdAt: number;
  provenance: Record<string, unknown>;
  references: string[];
}

export function Memory() {
  const [activeTab, setActiveTab] = useState<
    "identity" | "episodic" | "semantic"
  >("identity");

  // Semantic Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(5);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const identityQuery = useQuery({
    queryKey: ["identity"],
    queryFn: () => api.identity.list(),
  });

  const episodicQuery = useQuery({
    queryKey: ["episodic"],
    queryFn: () => api.episodic.list(50),
  });

  // Semantic Search Mutation
  const searchMutation = useMutation({
    mutationFn: async ({ query, limit }: { query: string; limit: number }) => {
      const results = await api.semantic.search(query, limit);
      return results;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setSummary(null); // Clear previous summary
    },
  });

  // Job Polling
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useQuery({
    queryKey: ["job", activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const job = await api.jobs.get(activeJobId);
      if (job.status === "completed") {
        if (job.result?.summary) {
          setSummary(job.result.summary);
        }
        setActiveJobId(null);
      } else if (job.status === "failed") {
        console.error("Job failed:", job.error);
        setActiveJobId(null);
      }
      return job;
    },
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1000;
    },
  });

  // Summarization Mutation
  const summarizeMutation = useMutation({
    mutationFn: async () => {
      if (searchResults.length === 0) return { summary: "" };
      const contents = searchResults.map((r) => r.content);
      return api.semantic.summarize(contents, searchQuery);
    },
    onSuccess: (data: any) => {
      if (data.jobId) {
        setActiveJobId(data.jobId);
        setSummary("Generating summary...");
      } else if (data.summary) {
        setSummary(data.summary);
      }
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate({ query: searchQuery, limit: searchLimit });
  };

  const isProcessing = summarizeMutation.isPending || !!activeJobId;

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
        <button
          onClick={() => setActiveTab("semantic")}
          className={clsx(
            "px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
            activeTab === "semantic"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-gray-400 hover:text-gray-200",
          )}
        >
          <Search className="w-4 h-4" />
          Semantic Search
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {/* Identity Tab */}
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

        {/* Episodic Tab */}
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

        {/* Semantic Search Tab */}
        {activeTab === "semantic" && (
          <div className="space-y-6">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search semantic memory..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-purple-500 text-white placeholder:text-gray-500"
                  />
                </div>
                <select
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value={3}>3 results</option>
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                </select>
                <button
                  type="submit"
                  disabled={searchMutation.isPending || !searchQuery.trim()}
                  className={clsx(
                    "px-6 py-3 rounded-lg font-medium flex items-center gap-2",
                    searchMutation.isPending
                      ? "bg-gray-700 text-gray-400"
                      : "bg-purple-500 hover:bg-purple-600 text-white",
                  )}
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </form>

            {/* Error Display */}
            {searchMutation.isError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {searchMutation.error instanceof Error
                  ? searchMutation.error.message
                  : "Search failed"}
              </div>
            )}

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                {/* Summarize Button */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {searchResults.length} Results
                  </h3>
                  <button
                    onClick={() => summarizeMutation.mutate()}
                    disabled={isProcessing}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm",
                      isProcessing
                        ? "bg-gray-700 text-gray-400"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white",
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isProcessing ? "Summarizing..." : "Summarize with AI"}
                  </button>
                </div>

                {/* AI Summary */}
                {summary && (
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span className="font-semibold text-purple-300">
                        AI Summary
                      </span>
                    </div>
                    <p className="text-gray-200">{summary}</p>
                  </div>
                )}

                {/* Result Cards */}
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-750"
                        onClick={() =>
                          setExpandedResult(
                            expandedResult === result.id ? null : result.id,
                          )
                        }
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                "px-2 py-1 rounded text-xs font-mono",
                                result.score > 0.8
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : result.score > 0.5
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-gray-700 text-gray-400",
                              )}
                            >
                              {(result.score * 100).toFixed(1)}%
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(result.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <button className="text-gray-500 hover:text-white">
                            {expandedResult === result.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="text-gray-200 line-clamp-2">
                          {result.content}
                        </p>
                      </div>

                      {/* Expanded Details */}
                      {expandedResult === result.id && (
                        <div className="p-4 bg-gray-900/50 border-t border-gray-700 space-y-3">
                          <div>
                            <h4 className="text-xs text-gray-500 uppercase mb-1">
                              Full Content
                            </h4>
                            <p className="text-gray-200">{result.content}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <h4 className="text-xs text-gray-500 uppercase mb-1">
                                Source
                              </h4>
                              <p className="text-gray-300">
                                {(result.provenance as { source_type?: string })
                                  .source_type || "unknown"}
                                :
                                {(result.provenance as { source_id?: string })
                                  .source_id || "unknown"}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-xs text-gray-500 uppercase mb-1">
                                References
                              </h4>
                              <p className="text-gray-300 font-mono text-xs">
                                {result.references?.length || 0} episodic
                                records
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-500 uppercase mb-1">
                              ID
                            </h4>
                            <p className="text-gray-400 font-mono text-xs">
                              {result.id}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {searchResults.length === 0 && !searchMutation.isPending && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Search your semantic memory using natural language</p>
                <p className="text-sm mt-1">
                  Results are ranked by vector similarity
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
