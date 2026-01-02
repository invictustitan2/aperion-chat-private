import * as RadixDialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import * as React from "react";

export type DialogVariant = "modal" | "sheet";
export type DialogSheetSide = "right" | "left" | "bottom" | "top";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export const DialogPortal = RadixDialog.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={clsx(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

function sheetPositionClasses(side: DialogSheetSide) {
  switch (side) {
    case "left":
      return "inset-y-0 left-0 h-full w-[85vw] max-w-sm";
    case "right":
      return "inset-y-0 right-0 h-full w-[85vw] max-w-sm";
    case "top":
      return "inset-x-0 top-0 w-full max-h-[85vh]";
    case "bottom":
    default:
      return "inset-x-0 bottom-0 w-full max-h-[85vh]";
  }
}

function sheetAnimationClasses(side: DialogSheetSide) {
  switch (side) {
    case "left":
      return "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left";
    case "right":
      return "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right";
    case "top":
      return "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top";
    case "bottom":
    default:
      return "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom";
  }
}

export type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof RadixDialog.Content
> & {
  variant?: DialogVariant;
  sheetSide?: DialogSheetSide;
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(
  (
    { className, children, variant = "modal", sheetSide = "right", ...props },
    ref,
  ) => {
    const isSheet = variant === "sheet";

    return (
      <DialogPortal>
        <DialogOverlay />
        <RadixDialog.Content
          ref={ref}
          className={clsx(
            "fixed z-50",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "motion-fast",
            isSheet
              ? clsx(
                  "flex flex-col",
                  "glass-dark border border-white/10",
                  "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
                  sheetPositionClasses(sheetSide),
                  sheetAnimationClasses(sheetSide),
                )
              : clsx(
                  "left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
                  "glass-dark border border-white/10 rounded-2xl shadow-subtle",
                ),
            className,
          )}
          {...props}
        >
          {children}
        </RadixDialog.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-1 p-4 border-b border-white/10",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={clsx("text-sm font-semibold text-white", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={clsx("text-xs text-gray-400", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "flex items-center justify-end gap-2 p-4 border-t border-white/10",
        className,
      )}
      {...props}
    />
  );
}
