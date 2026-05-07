"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, TrendingUp, AlertTriangle, X } from "lucide-react";

export type SwotToast = {
  id: string;
  title: string;
  status: string;
  reason: string;
};

const statusConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string; label: string }> = {
  CREATED: {
    icon: <CheckCircle2 size={16} />,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    label: "New insight discovered",
  },
  UPDATED: {
    icon: <TrendingUp size={16} />,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    label: "Profile updated",
  },
  STALE: {
    icon: <AlertTriangle size={16} />,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    label: "Needs attention",
  },
};

export function SwotToastContainer({ toasts, onDismiss }: { toasts: SwotToast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <SwotToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SwotToastCard({ toast, onDismiss }: { toast: SwotToast; onDismiss: () => void }) {
  const config = statusConfig[toast.status] ?? statusConfig.UPDATED;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 rounded-xl border ${config.border} ${config.bg} px-4 py-3 shadow-lg backdrop-blur-sm`}
      style={{ minWidth: 300, maxWidth: 380 }}
    >
      <span className={`mt-0.5 ${config.text}`}>{config.icon}</span>
      <div className="flex-1">
        <p className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>{config.label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-800">{toast.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{toast.reason}</p>
      </div>
      <button onClick={onDismiss} className="mt-0.5 text-gray-400 transition hover:text-gray-600">
        <X size={14} />
      </button>
    </motion.div>
  );
}
