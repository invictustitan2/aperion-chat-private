import { clsx } from "clsx";
import {
  Brain,
  Command,
  FileText,
  MessageSquare,
  ScrollText,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: "navigation" | "action" | "search";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define all commands
  const commands: CommandItem[] = [
    // Navigation
    {
      id: "nav-chat",
      label: "Go to Chat",
      description: "Open the chat interface",
      icon: MessageSquare,
      action: () => {
        navigate("/chat");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-memory",
      label: "Go to Memory",
      description: "Browse memory store",
      icon: Brain,
      action: () => {
        navigate("/memory");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-identity",
      label: "Go to Identity",
      description: "View identity records",
      icon: User,
      action: () => {
        navigate("/identity");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-receipts",
      label: "Go to Receipts",
      description: "View policy receipts",
      icon: FileText,
      action: () => {
        navigate("/receipts");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-logs",
      label: "Go to Logs",
      description: "View system logs",
      icon: ScrollText,
      action: () => {
        navigate("/logs");
        onClose();
      },
      category: "navigation",
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      description: "Configure preferences",
      icon: Settings,
      action: () => {
        navigate("/settings");
        onClose();
      },
      category: "navigation",
    },
    // Actions
    {
      id: "action-new-chat",
      label: "New Chat",
      description: "Start a new conversation",
      icon: MessageSquare,
      action: () => {
        navigate("/chat");
        // Clear chat input if possible
        setTimeout(() => {
          const input = document.querySelector(
            'input[placeholder*="message"]',
          ) as HTMLInputElement;
          input?.focus();
        }, 100);
        onClose();
      },
      category: "action",
    },
    {
      id: "action-search-memory",
      label: "Search Memory",
      description: "Search semantic memory",
      icon: Search,
      action: () => {
        navigate("/memory");
        onClose();
      },
      category: "action",
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  // Group commands by category
  const groupedCommands = {
    navigation: filteredCommands.filter((c) => c.category === "navigation"),
    action: filteredCommands.filter((c) => c.category === "action"),
    search: filteredCommands.filter((c) => c.category === "search"),
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Command className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
            </div>
          ) : (
            <>
              {groupedCommands.navigation.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Navigation
                  </div>
                  {groupedCommands.navigation.map((cmd, _idx) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        isSelected={selectedIndex === globalIdx}
                        onClick={cmd.action}
                      />
                    );
                  })}
                </div>
              )}
              {groupedCommands.action.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </div>
                  {groupedCommands.action.map((cmd) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        isSelected={selectedIndex === globalIdx}
                        onClick={cmd.action}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">
              ↓
            </kbd>
            <span>to navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">
              ↵
            </kbd>
            <span>to select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">
              esc
            </kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CommandRow({
  command,
  isSelected,
  onClick,
}: {
  command: CommandItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = command.icon;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
        isSelected
          ? "bg-emerald-500/20 text-emerald-400"
          : "text-gray-300 hover:bg-white/5",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{command.label}</div>
        {command.description && (
          <div className="text-xs text-gray-500 truncate">
            {command.description}
          </div>
        )}
      </div>
    </button>
  );
}
