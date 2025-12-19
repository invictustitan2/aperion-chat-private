import { clsx } from "clsx";
import { HTMLAttributes } from "react";

/**
 * Skeleton Components - Aperion UI
 *
 * Loading state placeholders to replace spinners.
 * Maintains glassmorphic aesthetic with subtle animation.
 */

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = ({
  variant = "rectangular",
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) => {
  const variants = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div
      className={clsx(
        "bg-white/10 animate-pulse",
        variants[variant],
        className,
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

/**
 * MessageSkeleton - Loading state for chat messages
 */
export const MessageSkeleton = ({ isUser = false }: { isUser?: boolean }) => {
  return (
    <div
      className={clsx(
        "flex gap-3 animate-pulse",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <Skeleton variant="circular" width={40} height={40} />

      {/* Content */}
      <div className={clsx("flex-1 space-y-2", isUser && "items-end flex")}>
        <div
          className={clsx(
            "flex flex-col gap-2",
            isUser ? "items-end" : "items-start",
          )}
        >
          <Skeleton width={80} height={12} className="rounded" />
          <Skeleton
            width={isUser ? 280 : 360}
            height={80}
            className="rounded-2xl"
          />
          <Skeleton width={120} height={10} className="rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * ConversationListSkeleton - Loading state for conversation list
 */
export const ConversationListSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="space-y-2 p-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse p-3 rounded-xl">
          <Skeleton width="75%" height={16} className="mb-2" />
          <Skeleton width="50%" height={12} />
        </div>
      ))}
    </div>
  );
};

/**
 * PageSkeleton - Loading state for full pages
 */
export const PageSkeleton = () => {
  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton width={200} height={32} />
        <Skeleton width={120} height={40} className="rounded-xl" />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton height={200} className="rounded-2xl" />
        <Skeleton height={200} className="rounded-2xl" />
      </div>

      <Skeleton height={300} className="rounded-2xl" />
    </div>
  );
};
