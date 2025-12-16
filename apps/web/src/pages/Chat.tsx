import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  CheckCircle,
  Download,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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

  // State for streaming response
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Mutation to send message (now with streaming)
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

      // 3. Get AI response via streaming
      setIsStreaming(true);
      setStreamingResponse("");

      await api.chat.stream(
        text,
        [],
        (token) => {
          // Append each token as it arrives
          setStreamingResponse((prev) => prev + token);
        },
        () => {
          // Stream complete - refresh to get persisted response
          setIsStreaming(false);
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

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
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  return (
    <div className="flex flex-col h-full relative" ref={chatContainerRef}>
      {/* Header */}
      <header className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-dark z-10">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Operator Chat
          </h1>
          <p className="text-gray-400 text-xs md:text-sm">
            Secure channel • Episodic logging active
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
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
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
        ref={scrollRef}
      >
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Error loading history: {error.message}</span>
          </div>
        ) : (
          history?.map((msg) => {
            const isUser = String(msg.provenance?.source_type) === "user";
            return (
              <div
                key={msg.id}
                className={clsx(
                  "flex flex-col gap-1 max-w-[85%] md:max-w-2xl animate-in fade-in slide-in-from-bottom-2",
                  isUser ? "self-end items-end" : "self-start items-start",
                )}
              >
                <div className="flex items-baseline gap-2 px-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                    {isUser ? "You" : "Aperion"}
                  </span>
                  <span className="text-[10px] font-mono text-white/20">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={clsx(
                    "p-3 md:p-4 rounded-2xl text-sm md:text-base shadow-sm backdrop-blur-sm border",
                    isUser
                      ? "bg-emerald-600/20 border-emerald-500/20 text-emerald-100 rounded-tr-sm"
                      : "bg-white/5 border-white/5 text-gray-200 rounded-tl-sm",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
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
                Streaming
              </span>
            </div>
            <div className="p-3 md:p-4 rounded-2xl rounded-tl-sm text-sm md:text-base shadow-sm backdrop-blur-sm border bg-purple-500/10 border-purple-500/20 text-gray-200">
              {streamingResponse}
              <span className="inline-block w-1 h-4 ml-0.5 bg-purple-400 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 glass-dark pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {sendMessage.isError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Failed to send: {sendMessage.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 md:gap-3 items-end">
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
            className="p-3 text-gray-400 hover:text-emerald-400 transition-colors bg-white/5 rounded-full hover:bg-white/10"
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

          {/* Voice Recording */}
          <button
            type="button"
            className={clsx(
              "p-3 transition-all rounded-full",
              isRecording
                ? "bg-red-500/80 text-white animate-pulse shadow-lg shadow-red-500/40"
                : isProcessingVoice
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-white/5 text-gray-400 hover:text-purple-400 hover:bg-white/10",
            )}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessingVoice}
            title={isRecording ? "Stop Recording" : "Voice Chat"}
          >
            {isProcessingVoice ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
              disabled={sendMessage.isPending}
            />
          </div>

          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-full font-medium transition-all shadow-lg shadow-emerald-900/40"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {/* Voice Error */}
        {voiceError && (
          <div className="mt-2 text-red-400 text-xs flex items-center gap-2 px-2">
            <AlertCircle className="w-3 h-3" />
            {voiceError}
          </div>
        )}
      </div>
    </div>
  );
}
