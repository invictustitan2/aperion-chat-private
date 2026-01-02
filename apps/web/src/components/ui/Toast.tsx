import * as RadixToast from "@radix-ui/react-toast";
import { clsx } from "clsx";
import * as React from "react";

export const ToastProvider = RadixToast.Provider;
export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof RadixToast.Viewport>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Viewport>
>(({ className, ...props }, ref) => (
  <RadixToast.Viewport
    ref={ref}
    className={clsx(
      "fixed z-[60]",
      "bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4",
      "flex w-[92vw] max-w-sm flex-col gap-2 outline-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

export const Toast = React.forwardRef<
  React.ElementRef<typeof RadixToast.Root>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Root>
>(({ className, ...props }, ref) => (
  <RadixToast.Root
    ref={ref}
    className={clsx(
      "glass-dark border border-white/10 rounded-xl shadow-subtle",
      "p-3",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      className,
    )}
    {...props}
  />
));
Toast.displayName = "Toast";

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof RadixToast.Title>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Title>
>(({ className, ...props }, ref) => (
  <RadixToast.Title
    ref={ref}
    className={clsx("text-sm font-semibold text-white", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof RadixToast.Description>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Description>
>(({ className, ...props }, ref) => (
  <RadixToast.Description
    ref={ref}
    className={clsx("mt-1 text-xs text-gray-300", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export const ToastAction = React.forwardRef<
  React.ElementRef<typeof RadixToast.Action>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Action>
>(({ className, ...props }, ref) => (
  <RadixToast.Action
    ref={ref}
    className={clsx(
      "ml-auto inline-flex items-center justify-center",
      "radius-full border bg-white/5 border-white/10",
      "px-3 py-1 text-xs text-gray-200 hover:bg-white/10",
      "focus-ring-visible",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof RadixToast.Close>,
  React.ComponentPropsWithoutRef<typeof RadixToast.Close>
>(({ className, ...props }, ref) => (
  <RadixToast.Close
    ref={ref}
    className={clsx(
      "radius-full border bg-white/5 border-white/10",
      "px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white",
      "focus-ring-visible",
      className,
    )}
    {...props}
  />
));
ToastClose.displayName = "ToastClose";

// Minimal helper for simple toasts without inventing a second system.
export function useSimpleToast() {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState<string | null>(null);

  const show = React.useCallback(
    (next: { title: string; description?: string }) => {
      setTitle(next.title);
      setDescription(next.description ?? null);
      setOpen(false);
      window.setTimeout(() => setOpen(true), 0);
    },
    [],
  );

  const toast = (
    <Toast open={open} onOpenChange={setOpen} duration={3500}>
      {title && <ToastTitle>{title}</ToastTitle>}
      {description && <ToastDescription>{description}</ToastDescription>}
      <div className="mt-2 flex items-center justify-end">
        <ToastClose aria-label="Close">Close</ToastClose>
      </div>
    </Toast>
  );

  return { show, toast };
}
