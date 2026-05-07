import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[88px] w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-black/45 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
