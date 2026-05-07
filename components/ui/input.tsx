import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-[var(--text)] outline-none transition placeholder:text-black/45 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
