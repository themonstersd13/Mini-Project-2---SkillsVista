"use client";

import { motion } from "framer-motion";

type SignalBadgeProps = {
  category: string;
  title: string;
  confidence: number;
};

const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string }
> = {
  STRENGTH: {
    color: "#6ee7b7",
    bg: "rgba(110, 231, 183, 0.12)",
    icon: "💪",
  },
  WEAKNESS: {
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.12)",
    icon: "⚠️",
  },
  OPPORTUNITY: {
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.12)",
    icon: "🚀",
  },
  THREAT: {
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.12)",
    icon: "🛡️",
  },
};

export function SignalBadge({ category, title, confidence }: SignalBadgeProps) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.WEAKNESS;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="signal-badge"
      style={{
        background: config.bg,
        borderColor: config.color,
      }}
    >
      <span className="signal-icon">{config.icon}</span>
      <span className="signal-title" style={{ color: config.color }}>
        {title}
      </span>
      <span
        className="signal-confidence"
        style={{ color: config.color }}
      >
        {(confidence * 100).toFixed(0)}%
      </span>
      <style jsx>{`
        .signal-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          border: 1px solid;
          font-size: 11px;
          backdrop-filter: blur(8px);
        }
        .signal-icon {
          font-size: 12px;
        }
        .signal-title {
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .signal-confidence {
          opacity: 0.7;
          font-size: 10px;
        }
      `}</style>
    </motion.div>
  );
}
