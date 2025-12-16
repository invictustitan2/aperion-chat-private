import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, KnowledgeRecord } from "../lib/api";

export function Knowledge() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [semanticId, setSemanticId] = useState("");

  const knowledgeQuery = useQuery({
    queryKey: ["knowledge", q],
    queryFn: async () => api.knowledge.list(100, 0, q.trim() || undefined),
  });

  const promote = useMutation({
    mutationFn: async () => api.knowledge.promote(semanticId.trim()),
    onSuccess: () => {
      setSemanticId("");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const items = useMemo(() => knowledgeQuery.data || [], [knowledgeQuery.data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge</h1>
          <p className="text-sm text-gray-400">
            Curated knowledge derived from semantic memories.
          </p>
        </div>
      </div>

      <div className="glass-dark border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search knowledge..."
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
            />
          </div>
          <button
            type="button"
            onClick={() => knowledgeQuery.refetch()}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-100 text-sm border border-white/10"
            disabled={knowledgeQuery.isFetching}
          >
            Refresh
          </button>
        </div>

        <div className="border-t border-white/10 pt-3">
          <label className="block text-xs text-gray-400 mb-1">
            Promote semantic memory → knowledge
          </label>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              value={semanticId}
              onChange={(e) => setSemanticId(e.target.value)}
              placeholder="Semantic ID"
              className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => promote.mutate()}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-sm border border-emerald-500/20"
              disabled={!semanticId.trim() || promote.isPending}
            >
              Promote
            </button>
          </div>
          {promote.isError && (
            <div className="mt-2 text-sm text-red-300">
              {(promote.error as Error).message}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {knowledgeQuery.isLoading && (
          <div className="text-sm text-gray-400">Loading…</div>
        )}
        {knowledgeQuery.isError && (
          <div className="text-sm text-red-300">
            {(knowledgeQuery.error as Error).message}
          </div>
        )}

        {items.length === 0 &&
          !knowledgeQuery.isLoading &&
          !knowledgeQuery.isError && (
            <div className="text-sm text-gray-400">No knowledge items yet.</div>
          )}

        {items.map((k: KnowledgeRecord) => (
          <div
            key={k.id}
            className="glass-dark border border-white/10 rounded-2xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">
                  {k.title}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Updated {new Date(k.updatedAt).toLocaleString()}
                  {k.sourceSemanticId ? ` • Source ${k.sourceSemanticId}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap">
              {k.content}
            </div>

            {k.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {k.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
