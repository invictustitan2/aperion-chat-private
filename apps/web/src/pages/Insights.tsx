import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, InsightsSummaryResponse } from "../lib/api";

export function Insights() {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [sources, setSources] = useState<InsightsSummaryResponse["sources"]>(
    [],
  );

  const run = useMutation({
    mutationFn: async () => api.insights.summarize(query.trim() || undefined),
    onSuccess: (res) => {
      setSources(res.sources || []);
      if (res.status === "queued") {
        setJobId(res.jobId);
        setSummary(null);
      } else {
        setJobId(null);
        setSummary(res.summary || null);
      }
    },
    onError: () => {
      setJobId(null);
    },
  });

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const j = await api.jobs.get(jobId);
        if (cancelled) return;
        if (j.status === "completed") {
          const text =
            typeof j.result === "string" ? j.result : (j.result?.summary ?? "");
          setSummary(text || null);
          setJobId(null);
          return;
        }
        if (j.status === "failed") {
          setSummary(j.error ? `Failed: ${j.error}` : "Failed");
          setJobId(null);
          return;
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setSummary(`Failed: ${msg}`);
          setJobId(null);
        }
        return;
      }

      setTimeout(poll, 750);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const sourcesLabel = useMemo(() => {
    if (!sources || sources.length === 0) return null;
    return sources
      .map((s) =>
        s.type === "semantic" ? `semantic:${s.id}` : `episodic:${s.id}`,
      )
      .join(", ");
  }, [sources]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Insights</h1>
        <p className="text-sm text-gray-400">
          Summaries and patterns generated from your stored memories.
        </p>
      </div>

      <div className="glass-dark border border-white/10 rounded-2xl p-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Query</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Optional: what should we focus on?"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => run.mutate()}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-sm border border-emerald-500/20"
            disabled={run.isPending}
          >
            Generate
          </button>
          {jobId && <div className="text-sm text-gray-400">Working…</div>}
        </div>

        {run.isError && (
          <div className="text-sm text-red-300">
            {(run.error as Error).message}
          </div>
        )}
      </div>

      {sourcesLabel && (
        <div className="text-xs text-gray-500">
          Sources: <span className="text-gray-400">{sourcesLabel}</span>
        </div>
      )}

      {summary && (
        <div className="glass-dark border border-white/10 rounded-2xl p-4">
          <div className="text-sm text-gray-200 whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}
    </div>
  );
}
