import { Search, X } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { Input } from "./ui";

/**
 * ConversationSearch Component
 *
 * Client-side search/filter for conversations
 */

interface ConversationSearchProps {
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

export function ConversationSearch({
  onSearchChange,
  placeholder = "Search conversations...",
}: ConversationSearchProps) {
  const [query, setQuery] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearchChange(value);
  };

  const handleClear = () => {
    setQuery("");
    onSearchChange("");
  };

  return (
    <div className="px-2 pb-2 relative">
      <Input
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        leftIcon={<Search className="w-4 h-4" />}
        rightIcon={
          query ? (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-white/10 rounded transition-colors focus-ring-visible"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : undefined
        }
        className="text-sm"
      />
    </div>
  );
}
