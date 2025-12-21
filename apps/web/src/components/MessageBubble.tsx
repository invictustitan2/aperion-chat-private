import { clsx } from "clsx";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Loader2,
  Pencil,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { MessageContent } from "./MessageContent";

/**
 * MessageBubble Component - Aperion Chat
 *
 * Displays a single message with:
 * - Consistent max-width for readability
 * - Hover/focus-accessible actions
 * - Keyboard navigation support
 * - Metadata display (model, derived memories, response time)
 */

export interface Message {
  id: string;
  content: string;
  createdAt: number;
  provenance?: {
    source_type?: string;
    model_version?: string;
    derived_from?: string[];
  };
}

interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
  isHighlighted?: boolean;
  isEditing?: boolean;
  editingContent?: string;
  editError?: string | null;
  copiedId?: string | null;
  rating?: "up" | "down" | null;
  responseTimeMs?: number;

  // Actions
  onCopy?: (id: string, content: string) => void;
  onShare?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onRate?: (id: string, rating: "up" | "down") => void;
  onEditingContentChange?: (content: string) => void;

  // State
  isSavingEdit?: boolean;
}

export function MessageBubble({
  message,
  isUser,
  isHighlighted = false,
  isEditing = false,
  editingContent = "",
  editError = null,
  copiedId = null,
  rating = null,
  responseTimeMs,
  onCopy,
  onShare,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onRate,
  onEditingContentChange,
  isSavingEdit = false,
}: MessageBubbleProps) {
  const derivedFrom = Array.isArray(message.provenance?.derived_from)
    ? message.provenance.derived_from
    : [];
  const modelVersion =
    typeof message.provenance?.model_version === "string"
      ? message.provenance.model_version
      : "";

  const hasMetadata =
    !isUser && (modelVersion || derivedFrom.length > 0 || responseTimeMs);

  return (
    <div
      data-message-id={message.id}
      className={clsx(
        "group flex flex-col gap-1 max-w-[85%] md:max-w-2xl animate-fade-in",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      {/* Header: Sender + Timestamp */}
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-2xs font-mono text-gray-500 uppercase tracking-wider">
          {isUser ? "You" : "Aperion"}
        </span>
        <time className="text-2xs font-mono text-white/20">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      {/* Message Content */}
      <div
        className={clsx(
          "p-4 md:p-3 rounded-2xl text-sm md:text-base shadow-sm backdrop-blur-sm border", // Mobile p-4, Desktop p-3
          "motion-base",
          isHighlighted && "ring-1 ring-white/20 border-white/20",
          isUser
            ? "bg-emerald-600/20 border-emerald-500/20 text-emerald-100 rounded-tr-sm"
            : "bg-white/5 border-white/5 text-gray-200 rounded-tl-sm",
        )}
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editingContent}
              onChange={(e) => onEditingContentChange?.(e.target.value)}
              rows={3}
              className="w-full resize-y bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus-ring-visible transition-all"
              disabled={isSavingEdit}
              autoFocus
            />
            {editError && (
              <div className="text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                {editError}
              </div>
            )}
          </div>
        ) : (
          <>
            <MessageContent content={message.content} />
            {hasMetadata && (
              <div className="mt-2 text-2xs font-mono text-white/30 flex flex-wrap gap-x-3 gap-y-1">
                {modelVersion && <span>model: {modelVersion}</span>}
                {derivedFrom.length > 0 && (
                  <span>
                    derived: {derivedFrom.length}{" "}
                    {derivedFrom.length === 1 ? "memory" : "memories"}
                  </span>
                )}
                {typeof responseTimeMs === "number" && (
                  <span>response: {(responseTimeMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Message Actions */}
      <div
        className={clsx(
          "flex items-center gap-1 px-1",
          "motion-base",
          // Mobile: Always visible. Desktop: Hover/Focus only
          "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        {isEditing ? (
          <>
            <button
              onClick={onSaveEdit}
              className={clsx(
                "btn-icon-sm absolute -left-10 top-0 shadow-subtle",
                isUser
                  ? "bg-white/10 text-gray-300"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
              )}
              title="Save edit"
              disabled={isSavingEdit}
              aria-label="Save edit"
            >
              {isSavingEdit ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md motion-fast focus-ring-visible"
              title="Cancel edit"
              disabled={isSavingEdit}
              aria-label="Cancel edit"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            {/* Share Link */}
            {onShare && (
              <button
                onClick={() => onShare(message.id)}
                className="text-gray-500 hover:text-white hover:bg-white/10 rounded-md motion-fast focus-ring-visible tap44"
                title="Copy shareable message link"
                aria-label="Share message"
              >
                {copiedId === `share:${message.id}` ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Copy Button */}
            {onCopy && (
              <button
                onClick={() => onCopy(message.id, message.content)}
                className="text-gray-500 hover:text-white hover:bg-white/10 rounded-md motion-fast focus-ring-visible tap44"
                title="Copy to clipboard"
                aria-label="Copy message"
              >
                {copiedId === message.id ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Edit Button (user messages only) */}
            {isUser && onEdit && (
              <button
                onClick={() => onEdit(message.id, message.content)}
                className="text-gray-500 hover:text-white hover:bg-white/10 rounded-md motion-fast focus-ring-visible tap44"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Rating Buttons (AI messages only) */}
            {!isUser && onRate && (
              <>
                <button
                  onClick={() => onRate(message.id, "up")}
                  className={clsx(
                    "rounded-md motion-fast focus-ring-visible tap44",
                    rating === "up"
                      ? "text-emerald-400 bg-emerald-500/20"
                      : "text-gray-500 hover:text-white hover:bg-white/10",
                  )}
                  title="Good response"
                  aria-label="Rate response as good"
                  aria-pressed={rating === "up"}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRate(message.id, "down")}
                  className={clsx(
                    "rounded-md motion-fast focus-ring-visible tap44",
                    rating === "down"
                      ? "text-red-400 bg-red-500/20"
                      : "text-gray-500 hover:text-white hover:bg-white/10",
                  )}
                  title="Poor response"
                  aria-label="Rate response as poor"
                  aria-pressed={rating === "down"}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
