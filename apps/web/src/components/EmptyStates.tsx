import { AlertCircle, Inbox, MessageSquare, Sparkles } from "lucide-react";
import { Card } from "./ui";

/**
 * Empty State Components - Aperion Chat
 *
 * Provides intentional, informative empty states for:
 * - No conversations
 * - No messages in conversation
 * - Error states
 */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card
      variant="glass-dark"
      padding="lg"
      className="flex flex-col items-center justify-center text-center max-w-md mx-auto my-8"
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all focus-ring-visible"
        >
          {action.label}
        </button>
      )}
    </Card>
  );
}

export function NoConversationsState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<MessageSquare className="w-8 h-8 text-emerald-500" />}
      title="No conversations yet"
      description="Start a new conversation to begin chatting with Aperion."
      action={{
        label: "Start Conversation",
        onClick: onCreate,
      }}
    />
  );
}

export function EmptyConversationState() {
  return (
    <EmptyState
      icon={<Inbox className="w-8 h-8 text-gray-500" />}
      title="No messages"
      description="This conversation is empty. Send a message to start."
    />
  );
}

export function AllMessagesEmptyState() {
  return (
    <EmptyState
      icon={<Sparkles className="w-8 h-8 text-purple-500" />}
      title="Welcome to Aperion"
      description="Your memory-backed AI assistant. Start a conversation to explore episodic and semantic knowledge."
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="w-8 h-8 text-red-500" />}
      title="Something went wrong"
      description={message}
      action={
        onRetry
          ? {
              label: "Try Again",
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}
