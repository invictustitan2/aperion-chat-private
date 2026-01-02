import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import * as React from "react";

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuPortal = RadixDropdownMenu.Portal;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={clsx(
        "z-50 min-w-44 overflow-hidden",
        "glass-dark border border-white/10 rounded-xl shadow-subtle",
        "p-1",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </RadixDropdownMenu.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={clsx(
      "flex cursor-default select-none items-center gap-2",
      "rounded-lg px-3 py-2 text-sm",
      "text-gray-200 outline-none",
      "focus:bg-white/10 focus:text-white",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Separator
    ref={ref}
    className={clsx("my-1 h-px bg-white/10", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Label
    ref={ref}
    className={clsx("px-3 py-2 text-xs font-mono text-gray-400", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <RadixDropdownMenu.CheckboxItem
    ref={ref}
    className={clsx(
      "flex cursor-default select-none items-center gap-2",
      "rounded-lg px-3 py-2 text-sm",
      "text-gray-200 outline-none",
      "focus:bg-white/10 focus:text-white",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </RadixDropdownMenu.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";
