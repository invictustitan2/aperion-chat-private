import { clsx } from "clsx";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { KeyboardEvent, useEffect, useState } from "react";

/**
 * ConversationItem Component - Aperion Chat
 *
 * Displays a conversation list item with:
 * - Title with truncation
 * - Last activity timestamp
 * - Active state styling
 * - Inline rename capability
 * - Keyboard-accessible  actions (rename/delete)
 */

export interface Conversation {
  id: string;
  title: string;
  updatedAt?: number;
  lastMessage?: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isRenaming?: boolean;
  renameDraft?: string;

  // Actions
  onClick: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onStartRename: (id: string, currentTitle: string) => void;
  onCancelRename: () => void;

  // State
  isDeleting?: boolean;
  isRenamePending?: boolean;
}

export function ConversationItem({
  conversation,
  isActive,
  isRenaming = false,
  renameDraft = "",
  onClick,
  onRename,
  onDelete,
  onStartRename,
  onCancelRename,
  isDeleting = false,
  isRenamePending = false,
}: ConversationItemProps) {
  const [localDraft, setLocalDraft] = useState(renameDraft);

  // Sync local draft with prop when it changes (e.g., when rename starts)
  useEffect(() => {
    setLocalDraft(renameDraft);
  }, [renameDraft]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onRename(conversation.id, localDraft);
    }
    if (e.key === "Escape") {
      onCancelRename();
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    const now = Date.now();
    const diff = now - ts;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div
      className={clsx(
        "group flex items-center gap-2 px-2 py-1 rounded-lg transition-all",
        isActive ? "bg-white/5" : "hover:bg-white/5",
      )}
    >
      {/* Main Content */}
      <button
        onClick={onClick}
        className={clsx(
          "flex-1 min-w-0 text-left px-2 py-2 rounded-md text-sm transition-colors focus-ring-visible",
          isActive ? "text-emerald-300" : "text-gray-300",
        )}
        title={conversation.title}
        aria-current={isActive ? "page" : undefined}
      >
        {isRenaming ? (
          <input
            value={localDraft}
            onChange={(e) => setLocalDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-black/20 border border-white/10 rounded-md px-2 py-1 text-white text-sm focus-ring-visible"
            autoFocus
            disabled={isRenamePending}
            aria-label="Rename conversation"
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="block truncate font-medium">
              {conversation.title}
            </span>
            {conversation.lastMessage && (
              <span className="block truncate text-xs text-gray-500">
                {conversation.lastMessage}
              </span>
            )}
            {conversation.updatedAt && (
              <span className="block text-2xs text-gray-600 font-mono">
                {formatTimestamp(conversation.updatedAt)}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Actions */}
      {!isRenaming && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => onStartRename(conversation.id, conversation.title)}
            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all focus-ring-visible"
            title="Rename"
            aria-label={`Rename ${conversation.title}`}
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(conversation.id)}
            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all focus-ring-visible"
            title="Delete"
            disabled={isDeleting}
            aria-label={`Delete ${conversation.title}`}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
