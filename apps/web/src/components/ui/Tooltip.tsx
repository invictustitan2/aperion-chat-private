import * as RadixTooltip from "@radix-ui/react-tooltip";
import { clsx } from "clsx";
import * as React from "react";

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={clsx(
        "z-50 overflow-hidden",
        "rounded-lg border border-white/10",
        "bg-black/60 backdrop-blur-sm",
        "px-2 py-1 text-[11px] text-gray-200",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </RadixTooltip.Portal>
));
TooltipContent.displayName = "TooltipContent";

export function IconButtonTooltip({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;

  // On coarse pointers (mobile), tooltips tend to be noisy; keep behavior simple.
  // Consumers can still provide aria-label for accessibility.
  const isCoarse =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  if (isCoarse) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
