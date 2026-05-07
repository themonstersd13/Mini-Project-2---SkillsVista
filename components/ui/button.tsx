import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]",
        variant === "ghost" && "bg-transparent text-[var(--text)] hover:bg-black/5",
        variant === "outline" && "border border-black/15 bg-white text-[var(--text)] hover:bg-black/5",
        className,
      )}
      {...props}
    />
  );
}
