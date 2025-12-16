import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Brain,
  Loader2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../lib/api";

function formatRangeLabel(r: "24h" | "7d" | "30d") {
  if (r === "24h") return "Last 24h";
  if (r === "7d") return "Last 7d";
  return "Last 30d";
}

function safeMax(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), 0);
}

export function Analytics() {
  const [days, setDays] = useState(30);

  const dashboard = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => api.analytics.dashboard(days),
    refetchInterval: 30000,
  });

  const chart = useMemo(() => {
    const d = dashboard.data;
    if (!d) return null;

    const series = d.days;
    const episodic = series.map((x) => x.episodicCount);
    const semantic = series.map((x) => x.semanticCount);
    const max = Math.max(safeMax(episodic), safeMax(semantic), 1);

    return { series, max };
  }, [dashboard.data]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 text-sm">
            Memory growth, AI activity, and topic distribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-900/40 border border-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Range</span>
            <select
              className="bg-transparent text-sm text-gray-200 outline-none"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <button
            onClick={() => dashboard.refetch()}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {dashboard.isLoading ? (
        <div className="p-8 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading analytics…
        </div>
      ) : dashboard.isError ? (
        <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300">
          Failed to load analytics: {String(dashboard.error)}
        </div>
      ) : !dashboard.data ? (
        <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/20 text-gray-400">
          No analytics data.
        </div>
      ) : (
        <>
          {/* Summary */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.data.summary.map((s) => (
              <div
                key={s.range}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-5"
              >
                <div className="text-xs uppercase tracking-wider text-gray-400">
                  {formatRangeLabel(s.range)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-200">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono">{s.userMessages}</span>
                    <span className="text-gray-400">user</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono">{s.assistantMessages}</span>
                    <span className="text-gray-400">assistant</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="font-mono">{s.episodicCount}</span>
                    <span className="text-gray-400">episodic</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="font-mono">{s.semanticCount}</span>
                    <span className="text-gray-400">semantic</span>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Growth chart */}
          <section className="bg-gray-800/40 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  Memory Growth
                </h2>
                <p className="text-sm text-gray-400">
                  Daily counts (episodic vs semantic).
                </p>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                Updated: {new Date(dashboard.data.generatedAt).toLocaleString()}
              </div>
            </div>

            {chart && (
              <div className="mt-6">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-400/70" />
                    Episodic
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-sm bg-purple-400/70" />
                    Semantic
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-1 overflow-x-auto no-scrollbar">
                  {chart.series.slice(-30).map((d) => {
                    const eH = Math.round((d.episodicCount / chart.max) * 36);
                    const sH = Math.round((d.semanticCount / chart.max) * 36);
                    return (
                      <div
                        key={d.date}
                        className="flex flex-col justify-end h-10 gap-[2px] w-2 shrink-0"
                        title={`${d.date}\nEpisodic: ${d.episodicCount}\nSemantic: ${d.semanticCount}`}
                      >
                        <div
                          className="w-2 rounded-sm bg-purple-400/70"
                          style={{ height: `${Math.max(1, sH)}px` }}
                        />
                        <div
                          className="w-2 rounded-sm bg-blue-400/70"
                          style={{ height: `${Math.max(1, eH)}px` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Showing last 30 days (bars).
                </div>
              </div>
            )}
          </section>

          {/* Topics + AI usage */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-100">
                Topic Distribution
              </h2>
              <p className="text-sm text-gray-400">
                Top terms from recent semantic memory.
              </p>

              {dashboard.data.topics.length === 0 ? (
                <div className="mt-4 text-sm text-gray-500">No topics yet.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dashboard.data.topics.map((t) => (
                    <div key={t.term} className="flex items-center gap-3">
                      <div className="w-28 text-sm text-gray-200 truncate">
                        {t.term}
                      </div>
                      <div className="flex-1 h-2 bg-gray-900/60 rounded">
                        <div
                          className="h-2 bg-emerald-500/60 rounded"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.round(
                                (t.count /
                                  Math.max(
                                    dashboard.data.topics[0]?.count ?? 1,
                                    1,
                                  )) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="w-10 text-right text-xs text-gray-400 font-mono">
                        {t.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-100">AI Usage</h2>
              <p className="text-sm text-gray-400">
                Approximate activity from assistant messages.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Assistant messages (30d)
                  </div>
                  <div className="mt-2 text-xl font-mono text-gray-100">
                    {dashboard.data.aiUsage.assistantMessages30d}
                  </div>
                </div>

                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Avg assistant chars (30d)
                  </div>
                  <div className="mt-2 text-xl font-mono text-gray-100">
                    {dashboard.data.aiUsage.avgAssistantChars30d}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
