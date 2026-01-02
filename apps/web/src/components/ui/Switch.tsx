import * as RadixSwitch from "@radix-ui/react-switch";
import { clsx } from "clsx";
import * as React from "react";

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, ...props }, ref) => (
  <RadixSwitch.Root
    className={clsx(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/10",
      className,
    )}
    {...props}
    ref={ref}
  >
    <RadixSwitch.Thumb
      className={clsx(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </RadixSwitch.Root>
));
Switch.displayName = RadixSwitch.Root.displayName;
