import { clsx } from "clsx";
import { HTMLAttributes } from "react";

/**
 * Card Component - Aperion UI
 *
 * Flexible container component using existing glass utilities.
 * Supports multiple variants aligned with glassmorphic design.
 */

type CardVariant = "default" | "glass" | "glass-dark" | "elevated";
type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
}

export const Card = ({
  variant = "default",
  padding = "md",
  hoverable = false,
  className,
  children,
  ...props
}: CardProps) => {
  const variants = {
    default: "bg-white/5 border border-white/10",
    glass: "glass",
    "glass-dark": "glass-dark",
    elevated: "bg-white/5 shadow-xl border border-white/10",
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4 md:p-6",
    lg: "p-6 md:p-8",
  };

  return (
    <div
      className={clsx(
        "rounded-2xl transition-all duration-200",
        variants[variant],
        paddings[padding],
        hoverable &&
          "hover:shadow-2xl hover:scale-[1.01] hover:border-white/20 cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
