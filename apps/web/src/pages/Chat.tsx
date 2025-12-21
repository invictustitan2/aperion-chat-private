import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Share2,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatInput } from "../components/ChatInput";
import { ConversationItem } from "../components/ConversationItem";
import { ConversationSearch } from "../components/ConversationSearch";
import {
  AllMessagesEmptyState,
  EmptyConversationState,
  NoConversationsState,
} from "../components/EmptyStates";
import { MessageBubble } from "../components/MessageBubble";
import { MessageContent } from "../components/MessageContent";
import {
  ConversationListSkeleton,
  MessageSkeleton,
} from "../components/ui/Skeleton";
import { useWebSocket } from "../hooks/useWebSocket";
import { api } from "../lib/api";

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function Chat() {
  const [searchParams] = useSearchParams();

  // WebSocket integration for real-time features
  const { isConnected, typingUsers, sendTyping } = useWebSocket();
  const [input, setInput] = useState("");
  const [isMemoryWriteEnabled, setIsMemoryWriteEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratedMessages, setRatedMessages] = useState<
    Record<string, "up" | "down">
  >({});
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [tone, setTone] = useState<"default" | "concise" | "detailed">(
    "default",
  );
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const queryClient = useQueryClient();

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const lastSeenLastMessageIdRef = useRef<string | null>(null);

  const streamingStartAtRef = useRef<number | null>(null);
  const lastPromptUserMessageIdRef = useRef<string | null>(null);
  const [responseTimeMsByUserMessageId, setResponseTimeMsByUserMessageId] =
    useState<Record<string, number>>({});
  const [streamingElapsedMs, setStreamingElapsedMs] = useState(0);

  const [slashIndex, setSlashIndex] = useState(0);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [renamingConversationId, setRenamingConversationId] = useState<
    string | null
  >(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");

  // Load tone preference (best-effort)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pref = await api.preferences.get("ai.tone");
        if (cancelled) return;
        const v = typeof pref.value === "string" ? pref.value : "";
        if (v === "concise" || v === "detailed" || v === "default") {
          setTone(v);
        }
      } catch {
        // ignore (missing pref or API unavailable)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onChangeTone = async (next: "default" | "concise" | "detailed") => {
    setTone(next);
    try {
      await api.preferences.set("ai.tone", next);
    } catch {
      // ignore
    }
  };

  const shareConversationLink = async () => {
    if (!activeConversationId) return;
    const url = new URL(window.location.href);
    url.pathname = "/chat";
    url.searchParams.set("conversation", activeConversationId);
    url.searchParams.delete("message");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedId("__share_conversation__");
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // ignore
    }
  };

  const shareMessageLink = async (messageId: string) => {
    const url = new URL(window.location.href);
    url.pathname = "/chat";
    if (activeConversationId) {
      url.searchParams.set("conversation", activeConversationId);
    } else {
      url.searchParams.delete("conversation");
    }
    url.searchParams.set("message", messageId);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedId(`share:${messageId}`);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // ignore
    }
  };

  // Support opening shared links: ?conversation=...&message=...
  useEffect(() => {
    const conv = searchParams.get("conversation");
    const msg = searchParams.get("message");

    if (conv && conv !== activeConversationId) {
      setActiveConversationId(conv);
    }
    if (msg) setHighlightMessageId(msg);
  }, []);

  // Fetch recent episodic memories as "chat history"
  const {
    data: history,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["episodic", activeConversationId],
    queryFn: () =>
      api.episodic.list(50, {
        conversationId: activeConversationId || undefined,
      }),
    refetchInterval: 5000, // Poll for updates
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.conversations.list(50, 0),
    refetchInterval: 5000,
  });

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    const conversations = conversationsQuery.data ?? [];
    const query = conversationSearchQuery.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((c) =>
      (c.title ?? "").toLowerCase().includes(query),
    );
  }, [conversationsQuery.data, conversationSearchQuery]);

  const createConversation = useMutation({
    mutationFn: async () => {
      return api.conversations.create();
    },
    onSuccess: (c) => {
      setActiveConversationId(c.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["episodic"] });
    },
  });

  const renameConversation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return api.conversations.rename(id, title);
    },
    onSuccess: () => {
      setRenamingConversationId(null);
      setConversationTitleDraft("");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingConversationId(id);
      return api.conversations.delete(id);
    },
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
    onSettled: () => {
      setDeletingConversationId(null);
    },
  });

  // State for streaming response
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDerivedFrom, setStreamingDerivedFrom] = useState<string[]>(
    [],
  );

  const slashCommands = [
    {
      command: "/clear",
      description: "Clear all messages",
    },
    {
      command: "/summarize",
      description: "Summarize this chat",
    },
  ] as const;

  const slashQuery = input.trim().startsWith("/")
    ? input.trim().split(/\s+/)[0]
    : "";
  const slashMatches = slashQuery
    ? slashCommands.filter((c) => c.command.startsWith(slashQuery))
    : [];
  const showSlashAutocomplete =
    slashQuery.length > 0 && slashMatches.length > 0 && input.trim() === input;

  const clearAll = useMutation({
    mutationFn: async () => {
      return api.episodic.clear();
    },
    onSuccess: () => {
      setInput("");
      setHasNewMessages(false);
      setNewMessagesCount(0);
      queryClient.invalidateQueries({ queryKey: ["episodic"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const summarizeChat = useMutation({
    mutationFn: async () => {
      const contents = (history || []).map((m) => m.content);
      if (contents.length === 0)
        return { summary: "(No messages to summarize.)" };
      return api.semantic.summarize(contents);
    },
    onSuccess: (res) => {
      setInput(res.summary);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
  });

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el) return;
    if (
      typeof (el as unknown as { scrollTo?: unknown }).scrollTo === "function"
    ) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  const getNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const threshold = 80;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= threshold;
  };

  const regenerateResponse = useMutation({
    mutationFn: async () => {
      const msgs = history || [];
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (String(msgs[i].provenance?.source_type) === "user") {
          lastUserIdx = i;
          break;
        }
      }

      if (lastUserIdx === -1) throw new Error("No user message to regenerate");

      const prompt = msgs[lastUserIdx].content;
      lastPromptUserMessageIdRef.current = msgs[lastUserIdx].id;
      const historySlice = msgs.slice(
        Math.max(0, lastUserIdx - 10),
        lastUserIdx,
      );
      const historyForModel = historySlice.map((m) => ({
        role:
          String(m.provenance?.source_type) === "user"
            ? ("user" as const)
            : ("assistant" as const),
        content: m.content,
      }));

      setIsStreaming(true);
      setStreamingResponse("");
      setStreamingDerivedFrom([]);
      streamingStartAtRef.current = Date.now();
      setStreamingElapsedMs(0);

      await api.chat.stream(
        prompt,
        historyForModel,
        activeConversationId || undefined,
        (token) => setStreamingResponse((prev) => prev + token),
        (meta) => {
          if (Array.isArray(meta.derived_from)) {
            setStreamingDerivedFrom(meta.derived_from);
          }
        },
        () => {
          setIsStreaming(false);
          const start = streamingStartAtRef.current;
          if (start) {
            const elapsed = Date.now() - start;
            const derived = streamingDerivedFrom;
            const lastUserId = lastPromptUserMessageIdRef.current;
            const key =
              lastUserId ||
              (Array.isArray(derived) && derived.length > 0
                ? derived[0]
                : null);
            if (key) {
              setResponseTimeMsByUserMessageId((prev) => ({
                ...prev,
                [key]: elapsed,
              }));
            }
          }
          queryClient.invalidateQueries({ queryKey: ["episodic"] });
        },
      );
    },
    onError: () => {
      setIsStreaming(false);
      setStreamingResponse("");
    },
  });

  // Mutation to send message (now with streaming)
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      // 1. Always write episodic (user message)
      const episodicRes = await api.episodic.create(
        text,
        {
          source_type: "user",
          source_id: "operator",
          timestamp: Date.now(),
          confidence: 1.0,
        },
        activeConversationId
          ? { conversation_id: activeConversationId }
          : undefined,
      );

      lastPromptUserMessageIdRef.current = episodicRes.id;

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

      // 3. Get AI response via streaming
      setIsStreaming(true);
      setStreamingResponse("");
      setStreamingDerivedFrom([]);
      streamingStartAtRef.current = Date.now();
      setStreamingElapsedMs(0);

      const historyForModel = (history || []).slice(-10).map((m) => ({
        role:
          String(m.provenance?.source_type) === "user"
            ? ("user" as const)
            : ("assistant" as const),
        content: m.content,
      }));

      await api.chat.stream(
        text,
        historyForModel,
        activeConversationId || undefined,
        (token) => {
          // Append each token as it arrives
          setStreamingResponse((prev) => prev + token);
        },
        (meta) => {
          if (Array.isArray(meta.derived_from)) {
            setStreamingDerivedFrom(meta.derived_from);
          }
        },
        () => {
          // Stream complete - refresh to get persisted response
          setIsStreaming(false);
          const start = streamingStartAtRef.current;
          if (start) {
            const elapsed = Date.now() - start;
            const derived = streamingDerivedFrom;
            const lastUserId = lastPromptUserMessageIdRef.current;
            const key =
              lastUserId ||
              (Array.isArray(derived) && derived.length > 0
                ? derived[0]
                : null);
            if (key) {
              setResponseTimeMsByUserMessageId((prev) => ({
                ...prev,
                [key]: elapsed,
              }));
            }
          }
          queryClient.invalidateQueries({ queryKey: ["episodic"] });
        },
      );

      return episodicRes;
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
    onError: () => {
      setIsStreaming(false);
      setStreamingResponse("");
    },
  });

  // Bottom-aware scroll + new message indicator
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const near = getNearBottom();
      setIsAtBottom(near);
      if (near) {
        setHasNewMessages(false);
        setNewMessagesCount(0);
        const lastId = (history || []).at(-1)?.id ?? null;
        lastSeenLastMessageIdRef.current = lastId;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [history]);

  useEffect(() => {
    if (!history) return;
    const lastId = history.at(-1)?.id ?? null;
    const prevLastId = lastSeenLastMessageIdRef.current;

    const appended = lastId !== null && lastId !== prevLastId;

    if (getNearBottom()) {
      scrollToBottom(history.length <= 1 ? "auto" : "smooth");
      setHasNewMessages(false);
      setNewMessagesCount(0);
      lastSeenLastMessageIdRef.current = lastId;
      return;
    }

    if (appended) {
      setHasNewMessages(true);
      setNewMessagesCount((c) => c + 1);
    }
  }, [history]);

  // Keep streaming pinned if at bottom.
  useEffect(() => {
    if (!isStreaming) return;
    if (!isAtBottom) return;
    scrollToBottom("auto");
  }, [isStreaming, streamingResponse, isAtBottom]);

  // Track streaming elapsed time for UI.
  useEffect(() => {
    if (!isStreaming) return;
    const start = streamingStartAtRef.current;
    if (!start) return;
    const t = window.setInterval(() => {
      setStreamingElapsedMs(Date.now() - start);
    }, 100);
    return () => window.clearInterval(t);
  }, [isStreaming]);

  // Mobile viewport changes (address bar / keyboard) can change available height.
  // If the user is already near the bottom, keep the chat pinned.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const el = scrollRef.current;
      if (!el) return;
      const threshold = 80;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance <= threshold) {
        el.scrollTop = el.scrollHeight;
      }
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // If a shared message is specified, scroll to it once it exists.
  useEffect(() => {
    const msg = searchParams.get("message");
    if (!msg) return;
    if (!history || history.length === 0) return;

    const el = document.querySelector(
      `[data-message-id="${CSS.escape(msg)}"]`,
    ) as HTMLElement | null;
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightMessageId(msg);
    const t = window.setTimeout(() => setHighlightMessageId(null), 2500);
    return () => window.clearTimeout(t);
  }, [history, searchParams]);

  const handleExport = async () => {
    if (!history || history.length === 0) {
      setExportError("No messages to export");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      // Generate HTML from chat history
      const messagesHtml = history
        .map(
          (msg) => `
          <div class="message ${String(msg.provenance?.source_type) === "assistant" ? "assistant" : "user"}">
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
              ${new Date(msg.createdAt).toLocaleString()}
            </div>
            <div>${msg.content}</div>
          </div>
        `,
        )
        .join("\n");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chat Export - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
            h1 { color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
            .message { margin-bottom: 15px; padding: 12px; border-radius: 8px; }
            .user { background: #f3f4f6; border-left: 3px solid #6b7280; }
            .assistant { background: #ecfdf5; border-left: 3px solid #10b981; }
          </style>
        </head>
        <body>
          <h1>Aperion Chat Export</h1>
          <p style="color: #666;">Exported on ${new Date().toLocaleString()}</p>
          ${messagesHtml}
        </body>
        </html>
      `;

      const blob = await api.chat.export(html);

      // Download the PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await processVoiceInput(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setVoiceError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);
    setVoiceError(null);

    try {
      const result = await api.chat.voice(audioBlob);

      // Play audio response
      if (result.audio && !result.useFrontendTts) {
        // Server provided audio (base64)
        const audioData = atob(result.audio);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const blob = new Blob([audioArray], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      } else if (result.useFrontendTts && "speechSynthesis" in window) {
        // Use Web Speech API for TTS
        const utterance = new SpeechSynthesisUtterance(result.assistantText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }

      // Refresh chat history
      queryClient.invalidateQueries({ queryKey: ["episodic"] });
    } catch (err) {
      console.error("Voice processing failed:", err);
      setVoiceError(err instanceof Error ? err.message : "Voice chat failed");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed === "/clear") {
      if (!clearAll.isPending) clearAll.mutate();
      return;
    }

    if (trimmed === "/summarize") {
      if (!summarizeChat.isPending) summarizeChat.mutate();
      return;
    }

    if (sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  const handleRate = (id: string, rating: "up" | "down") => {
    setRatedMessages((prev) => {
      if (prev[id] === rating) {
        // Toggle off if same rating
        const newState = { ...prev };
        delete newState[id];
        return newState;
      }
      return { ...prev, [id]: rating };
    });
    // TODO: Send rating to backend for AI improvement
  };

  const updateMessage = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return api.episodic.update(id, content);
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditingContent("");
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ["episodic"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      setEditError(msg || "Failed to update message");
    },
  });

  const startEditing = (id: string, content: string) => {
    setEditError(null);
    setEditingMessageId(id);
    setEditingContent(content);
  };

  const cancelEditing = () => {
    setEditError(null);
    setEditingMessageId(null);
    setEditingContent("");
  };

  const saveEditing = () => {
    if (!editingMessageId) return;
    const trimmed = editingContent.trim();
    if (!trimmed) {
      setEditError("Message cannot be empty");
      return;
    }
    setEditError(null);
    updateMessage.mutate({ id: editingMessageId, content: trimmed });
  };

  return (
    <div
      className="flex flex-col md:flex-row h-full min-h-0 overflow-hidden relative"
      ref={chatContainerRef}
    >
      {/* Conversations Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 glass-dark flex flex-col md:h-full shrink-0">
        <div className="p-4 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white">Conversations</div>
          <button
            onClick={() => createConversation.mutate()}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="New conversation"
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Conversation Search */}
        <ConversationSearch
          onSearchChange={setConversationSearchQuery}
          placeholder="Search conversations..."
        />

        <div className="px-2 pb-3 space-y-1 max-h-56 md:max-h-none flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <button
            onClick={() => setActiveConversationId(null)}
            className={clsx(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              activeConversationId === null
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-gray-300 hover:bg-white/5",
            )}
            title="View all messages"
          >
            All Messages
          </button>

          {conversationsQuery.isLoading ? (
            <ConversationListSkeleton count={5} />
          ) : conversationsQuery.error ? (
            <div className="px-3 py-2 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Failed to load
            </div>
          ) : conversationsQuery.data?.length === 0 ? (
            <NoConversationsState
              onCreate={() => createConversation.mutate()}
            />
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              No matches found
            </div>
          ) : (
            filteredConversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={activeConversationId === c.id}
                isRenaming={renamingConversationId === c.id}
                renameDraft={conversationTitleDraft}
                onClick={() => setActiveConversationId(c.id)}
                onRename={(id, title) =>
                  renameConversation.mutate({ id, title })
                }
                onDelete={(id) => deleteConversation.mutate(id)}
                onStartRename={(id, title) => {
                  setRenamingConversationId(id);
                  setConversationTitleDraft(title);
                }}
                onCancelRename={() => {
                  setRenamingConversationId(null);
                  setConversationTitleDraft("");
                }}
                isDeleting={
                  deleteConversation.isPending &&
                  deletingConversationId === c.id
                }
                isRenamePending={
                  renameConversation.isPending &&
                  renamingConversationId === c.id
                }
              />
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0">
        {/* Header */}
        <header className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-dark z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Operator Chat
            </h1>
            {/* Connection Status */}
            <span
              className={clsx(
                "p-1 rounded-full",
                isConnected ? "text-emerald-400" : "text-red-400",
              )}
              title={isConnected ? "Connected" : "Disconnected"}
            >
              {isConnected ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
            </span>
          </div>
          <p className="text-gray-400 text-xs md:text-sm">
            Secure channel • Episodic logging active • Context: last{" "}
            {Math.min(history?.length ?? 0, 10)} messages
          </p>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Tone Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border bg-white/5 border-white/10 text-xs md:text-sm backdrop-blur-sm">
              <span className="text-gray-400 font-medium">Tone</span>
              <select
                value={tone}
                onChange={(e) =>
                  onChangeTone(
                    e.target.value as "default" | "concise" | "detailed",
                  )
                }
                className="bg-transparent text-gray-200 outline-none"
                aria-label="AI tone"
              >
                <option value="default">Default</option>
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>

            {/* Regenerate last response */}
            <button
              onClick={() => regenerateResponse.mutate()}
              disabled={
                regenerateResponse.isPending ||
                isStreaming ||
                isLoading ||
                !(history || []).some(
                  (m) => String(m.provenance?.source_type) === "user",
                )
              }
              className={clsx(
                "p-2 rounded-full border transition-all backdrop-blur-sm",
                regenerateResponse.isPending || isStreaming
                  ? "bg-white/5 border-white/10 text-gray-600"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200",
              )}
              title="Regenerate last response"
            >
              {regenerateResponse.isPending || isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </button>

            {/* Share Conversation */}
            <button
              onClick={shareConversationLink}
              disabled={!activeConversationId}
              className={clsx(
                "p-2 rounded-full border transition-all backdrop-blur-sm",
                activeConversationId
                  ? "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                  : "bg-white/5 border-white/10 text-gray-600 cursor-not-allowed",
              )}
              title={
                activeConversationId
                  ? "Copy shareable conversation link"
                  : "Select a conversation to share"
              }
            >
              {copiedId === "__share_conversation__" ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting || !history?.length}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all text-xs md:text-sm backdrop-blur-sm",
                isExporting
                  ? "bg-white/5 border-white/10 text-gray-500"
                  : exportSuccess
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200",
              )}
            >
              {isExporting ? (
                <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
              ) : exportSuccess ? (
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
              ) : (
                <Download className="w-3 h-3 md:w-4 md:h-4" />
              )}
              <span className="font-medium">
                {isExporting
                  ? "Exporting..."
                  : exportSuccess
                    ? "Exported!"
                    : "Export PDF"}
              </span>
            </button>

            {/* Semantic Write Toggle */}
            <button
              onClick={() => setIsMemoryWriteEnabled(!isMemoryWriteEnabled)}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all text-xs md:text-sm backdrop-blur-sm",
                isMemoryWriteEnabled
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10",
              )}
            >
              {isMemoryWriteEnabled ? (
                <ToggleRight className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <ToggleLeft className="w-4 h-4 md:w-5 md:h-5" />
              )}
              <span className="font-medium">
                Semantic Write: {isMemoryWriteEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </header>

        {/* Export Error Message */}
        {exportError && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2 text-sm backdrop-blur-sm">
            <AlertCircle className="w-4 h-4" />
            {exportError}
          </div>
        )}

        {/* Chat Area */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6"
          ref={scrollRef}
        >
          {isLoading ? (
            <>
              <MessageSkeleton />
              <MessageSkeleton isUser />
              <MessageSkeleton />
            </>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Error loading history: {error.message}</span>
            </div>
          ) : history?.length === 0 ? (
            !activeConversationId ? (
              <AllMessagesEmptyState />
            ) : (
              <EmptyConversationState />
            )
          ) : (
            history?.map((msg, idx) => {
              const prev = idx > 0 ? history[idx - 1] : null;
              const showDaySeparator =
                !prev || !isSameDay(prev.createdAt, msg.createdAt);
              const isUser = String(msg.provenance?.source_type) === "user";

              const responseMs = Array.isArray(msg.provenance?.derived_from)
                ? msg.provenance.derived_from
                    .map((id) => responseTimeMsByUserMessageId[id])
                    .find((v) => typeof v === "number")
                : undefined;

              return (
                <React.Fragment key={msg.id}>
                  {showDaySeparator && (
                    <div className="flex items-center justify-center py-2">
                      <div className="px-3 py-1 rounded-full text-[10px] font-mono text-white/30 bg-white/5 border border-white/10">
                        {formatDayLabel(msg.createdAt)}
                      </div>
                    </div>
                  )}

                  <MessageBubble
                    message={msg}
                    isUser={isUser}
                    isHighlighted={highlightMessageId === msg.id}
                    isEditing={editingMessageId === msg.id}
                    editingContent={editingContent}
                    editError={editError}
                    copiedId={copiedId}
                    rating={ratedMessages[msg.id]}
                    responseTimeMs={responseMs}
                    onCopy={handleCopy}
                    onShare={shareMessageLink}
                    onEdit={startEditing}
                    onCancelEdit={cancelEditing}
                    onSaveEdit={saveEditing}
                    onRate={handleRate}
                    onEditingContentChange={(content) =>
                      setEditingContent(content)
                    }
                    isSavingEdit={
                      updateMessage.isPending && editingMessageId === msg.id
                    }
                  />
                </React.Fragment>
              );
            })
          )}

          {/* New messages indicator */}
          {hasNewMessages && (
            <div className="sticky bottom-4 flex justify-center pointer-events-none">
              <button
                type="button"
                onClick={() => {
                  scrollToBottom("smooth");
                  setHasNewMessages(false);
                  setNewMessagesCount(0);
                  lastSeenLastMessageIdRef.current =
                    (history || []).at(-1)?.id ?? null;
                }}
                className="pointer-events-auto px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs text-white/80 hover:bg-white/15 transition-all"
              >
                New messages
                {newMessagesCount > 0 ? ` (${newMessagesCount})` : ""}
              </button>
            </div>
          )}

          {/* Optimistic / Pending Message */}
          {sendMessage.isPending && !isStreaming && (
            <div className="flex flex-col gap-1 opacity-60 self-end items-end">
              <div className="bg-emerald-600/10 border border-emerald-500/10 rounded-2xl rounded-tr-sm p-3 md:p-4 text-emerald-100/80">
                {input}
              </div>
              <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Sending...
              </span>
            </div>
          )}

          {/* Streaming AI Response */}
          {isStreaming && streamingResponse && (
            <div className="flex flex-col gap-1 self-start items-start animate-in fade-in">
              <div className="flex items-baseline gap-2 px-1">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                  Aperion
                </span>
                <span className="text-[10px] font-mono text-purple-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                  Streaming • {(streamingElapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-3 md:p-4 rounded-2xl rounded-tl-sm text-sm md:text-base shadow-sm backdrop-blur-sm border bg-purple-500/10 border-purple-500/20 text-gray-200">
                <MessageContent content={streamingResponse} />
                <span className="inline-block w-1 h-4 ml-0.5 bg-purple-400 animate-pulse" />
              </div>
              {streamingDerivedFrom.length > 0 && (
                <div className="px-1 text-[10px] font-mono text-gray-500">
                  Influenced by: {streamingDerivedFrom.length} memory
                  {streamingDerivedFrom.length === 1 ? "" : "ies"}
                </div>
              )}
            </div>
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-gray-400 text-sm animate-in fade-in">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span>{typingUsers.join(", ")} is typing...</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0">
          <ChatInput
            value={input}
            onChange={(value: string) => {
              setSlashIndex(0);
              setInput(value);
              if (value) sendTyping();
            }}
            onSubmit={handleSubmit}
            onFileSelect={async (file: File) => {
              setIsUploading(true);
              try {
                const { key } = await api.media.upload(file);
                const url = api.media.getUrl(key);
                setInput((prev) =>
                  prev
                    ? `${prev}\n![${file.name}](${url})`
                    : `![${file.name}](${url})`,
                );
              } catch (err) {
                console.error("Upload failed", err);
              } finally {
                setIsUploading(false);
              }
            }}
            onVoiceRecord={startRecording}
            onVoiceStop={stopRecording}
            isSubmitting={
              sendMessage.isPending ||
              clearAll.isPending ||
              summarizeChat.isPending
            }
            isUploading={isUploading}
            isRecording={isRecording}
            isProcessingVoice={isProcessingVoice}
            error={
              sendMessage.error instanceof Error
                ? sendMessage.error.message
                : typeof sendMessage.error === "string"
                  ? sendMessage.error
                  : null
            }
            voiceError={voiceError}
            disabled={
              sendMessage.isPending ||
              clearAll.isPending ||
              isUploading ||
              isProcessingVoice
            }
            showCharCount={true}
            placeholder="Type a message..."
            slashAutocomplete={
              showSlashAutocomplete
                ? {
                    matches: slashMatches,
                    selectedIndex: slashIndex,
                    onSelect: (cmd: string) => setInput(cmd),
                    onNavigate: (dir: "up" | "down") =>
                      setSlashIndex((i) =>
                        dir === "down"
                          ? (i + 1) % slashMatches.length
                          : (i - 1 + slashMatches.length) % slashMatches.length,
                      ),
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
