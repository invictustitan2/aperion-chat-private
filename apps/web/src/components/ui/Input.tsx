import { clsx } from "clsx";
import { AlertCircle } from "lucide-react";
import { forwardRef, InputHTMLAttributes } from "react";

/**
 * Input Component - Aperion UI
 *
 * Form input with label, error states, and icon support.
 * Maintains glassmorphic aesthetic from existing patterns.
 */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, leftIcon, rightIcon, className, id, ...props },
    ref,
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              "w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500",
              "backdrop-blur-md transition-all duration-200",
              "focus-ring-visible",
              error
                ? "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-emerald-500",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {helperText && !error && (
          <div className="mt-2 text-sm text-gray-400">{helperText}</div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
