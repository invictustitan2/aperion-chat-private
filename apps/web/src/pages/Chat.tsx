import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  ImageIcon,
  Loader2,
  Send,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export function Chat() {
  const [input, setInput] = useState("");
  const [isMemoryWriteEnabled, setIsMemoryWriteEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { key } = await api.media.upload(file);
      const url = api.media.getUrl(key);
      const markdown = `![${file.name}](${url})`;

      setInput((prev) => (prev ? `${prev}\n${markdown}` : markdown));
    } catch (err) {
      console.error("Upload failed", err);
      // alert('Failed to upload image'); // Avoid alert in production?
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Fetch recent episodic memories as "chat history"
  const {
    data: history,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["episodic"],
    queryFn: () => api.episodic.list(50),
    refetchInterval: 5000, // Poll for updates
  });

  // Mutation to send message
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      // 1. Always write episodic (user message)
      const episodicRes = await api.episodic.create(text, {
        source_type: "user",
        source_id: "operator",
        timestamp: Date.now(),
        confidence: 1.0,
      });

      // 2. Optional: Write semantic if enabled (user explicitly confirmed via toggle)
      if (isMemoryWriteEnabled) {
        await api.semantic.create(text, [episodicRes.id], {
          source_type: "user",
          source_id: "operator",
          timestamp: Date.now(),
          confidence: 1.0,
          explicit_confirm: true, // User toggled semantic write = explicit confirmation
        });
      }

      // 3. Get AI response (which also stores in episodic memory)
      await api.chat.send(text);

      return episodicRes;
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["episodic"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold text-white">Operator Chat</h1>
          <p className="text-gray-400 text-sm">
            Secure channel • Episodic logging active
          </p>
        </div>

        <button
          onClick={() => setIsMemoryWriteEnabled(!isMemoryWriteEnabled)}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
            isMemoryWriteEnabled
              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
              : "bg-gray-800 border-gray-700 text-gray-400",
          )}
        >
          {isMemoryWriteEnabled ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">
            Semantic Write: {isMemoryWriteEnabled ? "ON" : "OFF"}
          </span>
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>Error loading history: {error.message}</span>
          </div>
        ) : (
          history?.map((msg) => (
            <div
              key={msg.id}
              className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-gray-500">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </span>
                <span className="text-xs font-mono text-emerald-500/50">
                  {msg.id.slice(0, 8)}
                </span>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 text-gray-200 max-w-3xl">
                {msg.content}
              </div>
            </div>
          ))
        )}

        {/* Optimistic / Pending Message */}
        {sendMessage.isPending && (
          <div className="flex flex-col gap-1 opacity-50">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 text-gray-200 max-w-3xl">
              {input}
            </div>
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Sending...
            </span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-gray-800 bg-gray-900">
        {sendMessage.isError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Failed to send: {sendMessage.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-4 items-center">
          {/* Image Upload */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-emerald-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            disabled={sendMessage.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
