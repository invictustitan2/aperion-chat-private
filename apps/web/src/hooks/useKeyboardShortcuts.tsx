import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  handler: () => void;
  description: string;
}

/**
 * Global keyboard shortcuts for the application
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  // Define all shortcuts
  const shortcuts: ShortcutHandler[] = [
    {
      key: "k",
      metaKey: true,
      handler: () => {
        // Focus search or navigate to chat
        navigate("/chat");
        // Focus the input after navigation
        setTimeout(() => {
          const input = document.querySelector(
            'input[placeholder*="message"]',
          ) as HTMLInputElement;
          input?.focus();
        }, 100);
      },
      description: "Quick search / Focus chat input",
    },
    {
      key: "n",
      metaKey: true,
      shiftKey: true,
      handler: () => {
        navigate("/chat");
      },
      description: "New chat",
    },
    {
      key: "m",
      metaKey: true,
      handler: () => {
        navigate("/memory");
      },
      description: "Go to Memory",
    },
    {
      key: ",",
      metaKey: true,
      handler: () => {
        navigate("/settings");
      },
      description: "Open Settings",
    },
    {
      key: "Escape",
      handler: () => {
        // Blur any focused input
        (document.activeElement as HTMLElement)?.blur();
      },
      description: "Clear focus / Close modals",
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except Escape)
      const isInput =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;

      if (isInput && event.key !== "Escape") {
        return;
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.metaKey
          ? event.metaKey || event.ctrlKey
          : !event.metaKey && !event.ctrlKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (metaMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

/**
 * Display component for showing available shortcuts
 */
export function ShortcutHints({
  shortcuts,
}: {
  shortcuts: {
    key: string;
    metaKey?: boolean;
    shiftKey?: boolean;
    description: string;
  }[];
}) {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");
  const cmdKey = isMac ? "⌘" : "Ctrl";

  return (
    <div className="space-y-2 text-sm text-gray-400">
      {shortcuts.map((shortcut) => (
        <div key={shortcut.key} className="flex justify-between items-center">
          <span>{shortcut.description}</span>
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono">
            {shortcut.metaKey && `${cmdKey}+`}
            {shortcut.shiftKey && "Shift+"}
            {shortcut.key.toUpperCase()}
          </kbd>
        </div>
      ))}
    </div>
  );
}
