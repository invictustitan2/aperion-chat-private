import * as RadixTabs from "@radix-ui/react-tabs";
import { clsx } from "clsx";
import * as React from "react";

export const Tabs = RadixTabs.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={clsx(
      "flex gap-2 border-b border-white/10",
      "overflow-x-auto no-scrollbar",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={clsx(
      "px-4 py-2 text-sm font-medium",
      "border-b-2 border-transparent",
      "text-gray-400 hover:text-gray-200",
      "data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/60",
      "focus-ring-visible",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={clsx("mt-4 focus:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
