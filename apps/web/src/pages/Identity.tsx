import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertCircle, Check, Loader2, Plus, Save, User } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

interface IdentityKey {
  key: string;
  id: string;
  createdAt: number;
  value: unknown;
  provenance: {
    source_type: string;
    source_id: string;
    timestamp: number;
    confidence: number;
  };
  hash: string;
  lastVerified?: number;
  preferredTone?: string;
  memoryRetentionDays?: number;
  interfaceTheme?: string;
}

export function Identity() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const {
    data: identities,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["identity"],
    queryFn: () => api.identity.list() as Promise<IdentityKey[]>,
  });

  const preferencesMutation = useMutation({
    mutationFn: async (prefs: {
      preferred_tone: string;
      memory_retention_days: number;
      interface_theme: string;
    }) => {
      return api.identity.create(
        "user_preferences",
        { note: "Global user preferences" },
        {
          source_type: "system",
          source_id: "user_settings",
          timestamp: Date.now(),
          confidence: 1.0,
        },
        prefs,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.identity.create(key, JSON.parse(value), {
        source_type: "user",
        source_id: "operator",
        timestamp: Date.now(),
        confidence: 1.0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
      setNewKey("");
      setNewValue("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.identity.create(key, JSON.parse(value), {
        source_type: "user",
        source_id: "operator",
        timestamp: Date.now(),
        confidence: 1.0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
      setEditingKey(null);
      setEditValue("");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    createMutation.mutate({ key: newKey, value: newValue });
  };

  const handleUpdate = (key: string) => {
    if (!editValue.trim()) return;
    updateMutation.mutate({ key, value: editValue });
  };

  const startEditing = (item: IdentityKey) => {
    setEditingKey(item.key);
    setEditValue(JSON.stringify(item.value, null, 2));
  };

  const prefs = identities?.find((i) => i.key === "user_preferences");
  const currentTone = prefs?.preferredTone || "casual";
  const currentRetention = prefs?.memoryRetentionDays || 30;
  const currentTheme = prefs?.interfaceTheme || "dark";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <User className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-bold">Identity & Preferences</h1>
        </div>
        <p className="text-gray-500 mt-1">
          Manage user profile, preferences, and identity facts.
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Helper for Preferences */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-blue-400">
            <Check className="w-5 h-5" />
            Global Preferences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="pref-tone"
                className="text-sm font-medium text-gray-400"
              >
                Preferred Tone
              </label>
              <select
                id="pref-tone"
                value={currentTone}
                onChange={(e) =>
                  preferencesMutation.mutate({
                    preferred_tone: e.target.value,
                    memory_retention_days: currentRetention,
                    interface_theme: currentTheme,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
              >
                <option value="casual">Casual & Friendly</option>
                <option value="formal">Formal & Concise</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="pirate">Pirate</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="pref-retention"
                className="text-sm font-medium text-gray-400"
              >
                Memory Retention (Days)
              </label>
              <input
                id="pref-retention"
                type="number"
                value={currentRetention}
                onChange={(e) =>
                  preferencesMutation.mutate({
                    preferred_tone: currentTone,
                    memory_retention_days: parseInt(e.target.value) || 30,
                    interface_theme: currentTheme,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="pref-theme"
                className="text-sm font-medium text-gray-400"
              >
                Interface Theme
              </label>
              <select
                id="pref-theme"
                value={currentTheme}
                onChange={(e) =>
                  preferencesMutation.mutate({
                    preferred_tone: currentTone,
                    memory_retention_days: currentRetention,
                    interface_theme: e.target.value,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
              >
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
                <option value="system">System Default</option>
              </select>
            </div>
          </div>
          {preferencesMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving preferences...
            </div>
          )}
        </section>

        {/* Add New Identity */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            Add Identity Fact
          </h2>
          <form
            onSubmit={handleCreate}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Key (e.g., user_name)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder='Value (JSON, e.g., "John Doe")'
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={
                createMutation.isPending || !newKey.trim() || !newValue.trim()
              }
              className={clsx(
                "px-4 py-2 rounded-lg font-medium flex items-center gap-2",
                createMutation.isPending
                  ? "bg-gray-700 text-gray-400"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white",
              )}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Identity
            </button>
            {createMutation.isError && (
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Failed to create"}
              </p>
            )}
          </form>
        </section>

        {/* Identity List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Stored Identities</h2>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading identities...
            </div>
          ) : error ? (
            <div className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Error: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : identities?.length === 0 ? (
            <p className="text-gray-500">No identities stored yet.</p>
          ) : (
            <div className="space-y-3">
              {identities
                ?.filter((i) => i.key !== "user_preferences")
                .map((item) => (
                  <div
                    key={item.key}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-mono text-emerald-400">
                          {item.key}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Last verified:{" "}
                          {item.lastVerified
                            ? new Date(item.lastVerified).toLocaleString()
                            : "Never"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(item)}
                          className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {editingKey === item.key ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={4}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(item.key)}
                            disabled={updateMutation.isPending}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 rounded text-sm flex items-center gap-1"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre className="mt-3 bg-gray-900 rounded p-3 text-sm overflow-auto max-h-40 text-gray-300">
                        {JSON.stringify(item.value, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
