import { clsx } from "clsx";
import {
  AlertCircle,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Send,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./ui";

/**
 * ChatInput Component - Aperion Chat
 *
 * Features:
 * - Auto-resizing textarea
 * - Enter sends, Shift+Enter newline
 * - Disabled when empty
 * - Character counter
 * - Voice recording integration
 * - Image upload
 * - Keyboard shortcuts displayed
 * - Mobile-safe (no layout jump)
 */

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onFileSelect?: (file: File) => void;
  onVoiceRecord?: () => void;
  onVoiceStop?: () => void;

  // State
  isSubmitting?: boolean;
  isUploading?: boolean;
  isRecording?: boolean;
  isProcessingVoice?: boolean;
  error?: string | null;
  voiceError?: string | null;
  disabled?: boolean;

  // Optional features
  showCharCount?: boolean;
  maxChars?: number;
  placeholder?: string;

  // Slash command autocomplete
  slashAutocomplete?: {
    matches: Array<{ command: string; description: string }>;
    selectedIndex: number;
    onSelect: (command: string) => void;
    onNavigate: (direction: "up" | "down") => void;
  };
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onFileSelect,
  onVoiceRecord,
  onVoiceStop,
  isSubmitting = false,
  isUploading = false,
  isRecording = false,
  isProcessingVoice = false,
  error = null,
  voiceError = null,
  disabled = false,
  showCharCount = true,
  maxChars,
  placeholder = "Type a message...",
  slashAutocomplete,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState(1);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to recalculate
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // approximate px per line
      const maxRows = 10;
      const newRows = Math.min(
        Math.max(1, Math.ceil(scrollHeight / lineHeight)),
        maxRows,
      );
      setRows(newRows);
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash autocomplete navigation
    if (slashAutocomplete && slashAutocomplete.matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        slashAutocomplete.onNavigate("down");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        slashAutocomplete.onNavigate("up");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const selected =
          slashAutocomplete.matches[slashAutocomplete.selectedIndex];
        if (selected) {
          e.preventDefault();
          slashAutocomplete.onSelect(selected.command);
          return;
        }
      }
    }

    // Enter sends, Shift+Enter newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDisabled = disabled || isSubmitting;
  const canSubmit = value.trim().length > 0 && !isDisabled;

  const charWarning = maxChars && value.length > maxChars * 0.9;
  const charExceeded = maxChars && value.length > maxChars;

  return (
    <div className="p-4 border-t border-white/10 glass-dark pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0">
      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 md:gap-3 items-end">
        {/* Image Upload */}
        {onFileSelect && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept="image/*"
              onChange={handleFileChange}
              aria-label="Upload image"
            />
            <button
              type="button"
              className="text-gray-400 hover:text-emerald-400 transition-colors bg-white/5 rounded-full hover:bg-white/10 focus-ring-visible flex-shrink-0 tap44"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Image"
              aria-label="Attach image"
              disabled={isUploading || isDisabled}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </button>
          </>
        )}

        {/* Voice Recording */}
        {(onVoiceRecord || onVoiceStop) && (
          <button
            type="button"
            className={clsx(
              "transition-all rounded-full focus-ring-visible flex-shrink-0 tap44",
              isRecording
                ? "bg-red-500/80 text-white animate-pulse shadow-lg shadow-red-500/40"
                : isProcessingVoice
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-white/5 text-gray-400 hover:text-purple-400 hover:bg-white/10",
            )}
            onClick={isRecording ? onVoiceStop : onVoiceRecord}
            disabled={isProcessingVoice || isDisabled}
            title={isRecording ? "Stop Recording" : "Voice Chat"}
            aria-label={isRecording ? "Stop recording" : "Start voice chat"}
            aria-pressed={isRecording}
          >
            {isProcessingVoice ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Textarea Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            disabled={isDisabled}
            className={clsx(
              "w-full resize-none bg-black/20 border rounded-2xl px-4 py-3",
              "text-white placeholder-gray-500",
              "focus-ring-visible transition-all",
              charExceeded
                ? "border-red-500/50"
                : charWarning
                  ? "border-yellow-500/50"
                  : "border-white/10",
            )}
            aria-label="Message input"
            aria-invalid={charExceeded ? "true" : undefined}
            aria-describedby={showCharCount ? "char-counter" : undefined}
          />

          {/* Slash Autocomplete */}
          {slashAutocomplete && slashAutocomplete.matches.length > 0 && (
            <div
              className="absolute left-0 right-0 bottom-full mb-2 bg-black/90 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm max-h-48 overflow-y-auto"
              role="listbox"
            >
              {slashAutocomplete.matches.map((c, i) => (
                <button
                  key={c.command}
                  type="button"
                  onClick={() => slashAutocomplete.onSelect(c.command)}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between transition-colors",
                    i === slashAutocomplete.selectedIndex
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5",
                  )}
                  role="option"
                  aria-selected={i === slashAutocomplete.selectedIndex}
                >
                  <span>{c.command}</span>
                  <span className="text-white/30 text-xs">{c.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Helper Text */}
          <div
            className="mt-1 px-2 flex justify-end md:justify-between text-2xs font-mono text-white/20"
            id="char-counter"
          >
            <span className="hidden md:flex items-center gap-2">
              <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10">
                Enter
              </kbd>
              <span>to send</span>
              <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10">
                Shift+Enter
              </kbd>
              <span>for newline</span>
            </span>
            {showCharCount && (
              <span
                className={clsx(
                  charExceeded
                    ? "text-red-400"
                    : charWarning
                      ? "text-yellow-400"
                      : "",
                )}
              >
                {value.length}
                {maxChars && ` / ${maxChars}`} chars
              </span>
            )}
          </div>
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!canSubmit}
          isLoading={isSubmitting}
          className="flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </Button>
      </form>

      {/* Voice Error */}
      {voiceError && (
        <div className="mt-2 text-red-400 text-xs flex items-center gap-2 px-2">
          <AlertCircle className="w-3 h-3" />
          {voiceError}
        </div>
      )}
    </div>
  );
}
