import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/10 bg-white/80 backdrop-blur-sm shadow-[0_20px_45px_-30px_rgba(12,22,32,0.45)]",
        className,
      )}
      {...props}
    />
  );
}
