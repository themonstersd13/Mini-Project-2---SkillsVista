"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-2xl border border-black/8 bg-white px-4 py-3 shadow-sm">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-2 rounded-full bg-[var(--brand)]"
          animate={{
            y: [0, -5, 0],
            opacity: [0.35, 1, 0.35],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
