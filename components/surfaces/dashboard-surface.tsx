"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  Clock,
  Sparkles,
  Eye,
  Archive,
  X,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Info,
} from "lucide-react";
import { AppNav } from "@/components/shared/app-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/client";
import { formatConfidence } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────── */

type SwotItem = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  status: "ACTIVE" | "UNCERTAIN" | "STALE" | "RETIRED";
  lastUpdatedAt: string;
  evidence: Array<{ id: string }>;
  versions: Array<{ id: string; reason: string; createdAt: string }>;
};

type HistoryResponse = {
  item: {
    id: string;
    title: string;
    category: string;
    status: string;
    confidence: number;
    lastUpdatedAt: string;
  };
  versions: Array<{
    id: string;
    reason: string;
    confidenceFrom: number;
    confidenceTo: number;
    statusFrom: string;
    statusTo: string;
    createdAt: string;
  }>;
  evidence: Array<{
    id: string;
    type: string;
    source: string;
    excerpt: string;
    score: number;
    createdAt: string;
  }>;
};

type BoardResponse = {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
};

type AnalyticsResponse = {
  counts: Record<string, number>;
  tasks: { completed: number; total: number };
  activityStreak: number;
};

/* ─── Quadrant Config ────────────────────────────────────── */

const quadrants: Array<{
  key: keyof BoardResponse;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  accentColor: string;
  borderColor: string;
}> = [
  {
    key: "strengths",
    label: "Strengths",
    subtitle: "What you're great at",
    icon: <Zap size={18} />,
    gradient: "from-emerald-500/10 to-teal-500/5",
    iconBg: "bg-emerald-100 text-emerald-600",
    accentColor: "text-emerald-600",
    borderColor: "border-emerald-200",
  },
  {
    key: "weaknesses",
    label: "Weaknesses",
    subtitle: "Areas to improve",
    icon: <AlertTriangle size={18} />,
    gradient: "from-amber-500/10 to-orange-500/5",
    iconBg: "bg-amber-100 text-amber-600",
    accentColor: "text-amber-600",
    borderColor: "border-amber-200",
  },
  {
    key: "opportunities",
    label: "Opportunities",
    subtitle: "Things you can leverage",
    icon: <Lightbulb size={18} />,
    gradient: "from-blue-500/10 to-indigo-500/5",
    iconBg: "bg-blue-100 text-blue-600",
    accentColor: "text-blue-600",
    borderColor: "border-blue-200",
  },
  {
    key: "threats",
    label: "Threats",
    subtitle: "Challenges to watch out for",
    icon: <ShieldAlert size={18} />,
    gradient: "from-rose-500/10 to-red-500/5",
    iconBg: "bg-rose-100 text-rose-600",
    accentColor: "text-rose-600",
    borderColor: "border-rose-200",
  },
];

/* ─── Status helpers ─────────────────────────────────────── */

const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Active" },
  UNCERTAIN: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Needs More Info" },
  STALE: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Outdated" },
  RETIRED: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400", label: "Retired" },
};

function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/8">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] font-medium text-black/50">{pct}%</span>
    </div>
  );
}

function isRecentlyUpdated(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 1000 * 60 * 60; // Within last hour
}

/* ─── Main Component ─────────────────────────────────────── */

export function DashboardSurface() {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadData() {
    setError(null);

    try {
      const [boardData, analyticsData] = await Promise.all([
        apiFetch<BoardResponse>("/api/swot"),
        apiFetch<AnalyticsResponse>("/api/analytics"),
      ]);
      setBoard(boardData);
      setAnalytics(analyticsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  // Poll for new SWOT updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [loading]);

  const totalItems = useMemo(() => {
    if (!board) return 0;
    return board.strengths.length + board.weaknesses.length + board.opportunities.length + board.threats.length;
  }, [board]);

  const recentlyAdded = useMemo(() => {
    if (!board) return 0;
    const all = [...board.strengths, ...board.weaknesses, ...board.opportunities, ...board.threats];
    return all.filter((item) => isRecentlyUpdated(item.lastUpdatedAt)).length;
  }, [board]);

  async function markRetired(id: string) {
    setLoading(true);
    await apiFetch("/api/swot", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "RETIRED" }),
    });
    await loadData();
  }

  async function openHistory(id: string) {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<HistoryResponse>(`/api/swot/${id}/history`);
      setHistory(data);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">

        {/* ── Page Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text)]">Your SWOT Profile</h1>
          <p className="mt-1 text-sm text-black/50">
            Your personal strengths, weaknesses, opportunities, and threats — discovered through your coaching conversations.
          </p>
        </div>

        {/* ── Stats Cards ── */}
        <section className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/10">
                <BarChart3 size={20} className="text-[var(--brand)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-black/45">Total Insights</p>
                <p className="text-2xl font-bold">{loading ? "..." : totalItems}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-black/45">Tasks Done</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : `${analytics?.tasks.completed ?? 0}/${analytics?.tasks.total ?? 0}`}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <TrendingUp size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-black/45">Activity Streak</p>
                <p className="text-2xl font-bold">{loading ? "..." : `${analytics?.activityStreak ?? 0} days`}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Sparkles size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-black/45">Recently Updated</p>
                <p className="text-2xl font-bold">{loading ? "..." : recentlyAdded}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* ── Recently Updated Banner ── */}
        {!loading && recentlyAdded > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
          >
            <Sparkles size={18} className="text-blue-600" />
            <p className="text-sm font-medium text-blue-700">
              {recentlyAdded} insight{recentlyAdded > 1 ? "s were" : " was"} recently updated from your coaching chat!
            </p>
            <span className="ml-auto text-xs text-blue-500">Auto-refreshes every 15s</span>
          </motion.div>
        )}

        {/* ── Loading / Error / Empty ── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
              <p className="text-sm text-black/50">Loading your SWOT profile...</p>
            </div>
          </div>
        )}

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {!loading && !error && board && totalItems === 0 && (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)]/10">
              <BarChart3 size={32} className="text-[var(--brand)]" />
            </div>
            <p className="text-xl font-bold">No SWOT insights yet</p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-black/55">
              Your SWOT profile builds automatically as you chat with your coach.
              Share your progress, challenges, goals, and experiences — the coach will
              identify your <strong>Strengths</strong>, <strong>Weaknesses</strong>,{" "}
              <strong>Opportunities</strong>, and <strong>Threats</strong> and track them here.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quadrants.map((q) => (
                <div key={q.key} className={`rounded-xl border ${q.borderColor} bg-gradient-to-br ${q.gradient} p-4 text-left`}>
                  <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${q.iconBg}`}>{q.icon}</div>
                  <p className={`text-sm font-semibold ${q.accentColor}`}>{q.label}</p>
                  <p className="mt-0.5 text-xs text-black/50">{q.subtitle}</p>
                </div>
              ))}
            </div>
            <Button className="mt-6" onClick={() => window.location.href = "/coach"}>
              Start a Chat Session →
            </Button>
          </Card>
        )}

        {/* ── SWOT Board — 2×2 Grid ── */}
        {!loading && board && totalItems > 0 && (
          <>
            {/* What is SWOT info banner */}
            <div className="mb-5 rounded-xl border border-black/8 bg-white/90 px-5 py-4">
              <div className="flex items-start gap-3">
                <Info size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-black/55">
                  <span><strong className="text-emerald-600">Strengths</strong> — Skills and qualities you excel at</span>
                  <span><strong className="text-amber-600">Weaknesses</strong> — Areas where you can grow</span>
                  <span><strong className="text-blue-600">Opportunities</strong> — External resources and advantages you can use</span>
                  <span><strong className="text-rose-600">Threats</strong> — Obstacles and challenges to be aware of</span>
                </div>
              </div>
            </div>

            {/* 2×2 SWOT Grid */}
            <section className="grid gap-4 md:grid-cols-2">
              {quadrants.map((quadrant, index) => (
                <motion.div
                  key={quadrant.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="flex h-full flex-col overflow-hidden p-0">
                    {/* Quadrant Header */}
                    <div className={`flex items-center gap-3 border-b border-black/6 bg-gradient-to-r ${quadrant.gradient} px-5 py-4`}>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${quadrant.iconBg}`}>
                        {quadrant.icon}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[var(--text)]">{quadrant.label}</h2>
                        <p className="text-xs text-black/45">{quadrant.subtitle}</p>
                      </div>
                      <span className="ml-auto text-lg font-bold text-black/20">{board[quadrant.key].length}</span>
                    </div>

                    {/* Items — Scrollable container */}
                    <div className="max-h-[340px] overflow-y-auto">
                      <div className="space-y-0 divide-y divide-black/6 px-4">
                        {board[quadrant.key].map((item) => {
                          return (
                            <article
                              key={item.id}
                              className="relative py-4"
                            >

                              <div className="mb-1.5 flex items-start justify-between gap-2">
                                <p className="font-semibold text-[var(--text)]">{item.title}</p>
                                <StatusBadge status={item.status} />
                              </div>

                              <p className="text-sm leading-relaxed text-black/60">{item.description}</p>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-black/35">Confidence</p>
                                    <ConfidenceMeter value={item.confidence} />
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-black/40">
                                    <Clock size={11} />
                                    {formatDistanceToNow(new Date(item.lastUpdatedAt), { addSuffix: true })}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openHistory(item.id)}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black/70"
                                  >
                                    <Eye size={12} /> History
                                  </button>
                                  <button
                                    onClick={() => markRetired(item.id)}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-black/40 transition hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Archive size={12} /> Retire
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                        {board[quadrant.key].length === 0 && (
                          <p className="py-6 text-center text-sm text-black/35">
                            No {quadrant.label.toLowerCase()} discovered yet. Keep chatting with your coach!
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </section>

            {/* ── History Panel (shown as modal-like overlay) ── */}
            {(history || historyLoading) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                onClick={() => setHistory(null)}
              >
                <Card
                  className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setHistory(null)}
                    className="absolute right-4 top-4 text-black/30 transition hover:text-black/60"
                  >
                    <X size={18} />
                  </button>

                  <h3 className="mb-4 text-lg font-bold text-[var(--text)]">Change History</h3>

                  {historyLoading && <p className="text-sm text-black/45">Loading history...</p>}

                  {history && (
                    <>
                      <div className="rounded-xl border border-black/8 bg-gradient-to-r from-black/[0.02] to-transparent p-3">
                        <p className="font-semibold text-[var(--text)]">{history.item.title}</p>
                        <p className="mt-1 text-xs text-black/50">
                          {history.item.category.charAt(0) + history.item.category.slice(1).toLowerCase()} •{" "}
                          <StatusBadge status={history.item.status} />
                        </p>
                      </div>

                      {/* Evidence */}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/40">
                          Evidence ({history.evidence.length})
                        </p>
                        {history.evidence.length === 0 && (
                          <p className="text-xs text-black/40">No evidence recorded yet.</p>
                        )}
                        {history.evidence.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="mb-2 rounded-lg border border-black/6 bg-white p-3">
                            <p className="text-xs font-medium text-black/60">
                              {entry.type.replaceAll("_", " ").toLowerCase()}
                            </p>
                            <p className="mt-1 text-xs text-black/50 italic">&quot;{entry.excerpt}&quot;</p>
                          </div>
                        ))}
                      </div>

                      {/* Timeline */}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/40">
                          Changes ({history.versions.length})
                        </p>
                        {history.versions.length === 0 && (
                          <p className="text-xs text-black/40">No changes recorded yet.</p>
                        )}
                        <div className="relative space-y-0 border-l-2 border-black/8 pl-4">
                          {history.versions.slice(0, 5).map((version) => (
                            <div key={version.id} className="relative pb-4">
                              <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--brand)]" />
                              <p className="text-xs font-medium text-[var(--text)]">{version.reason}</p>
                              <p className="mt-0.5 text-[11px] text-black/45">
                                Confidence: {formatConfidence(version.confidenceFrom)} → {formatConfidence(version.confidenceTo)}
                              </p>
                              <p className="text-[10px] text-black/35">
                                {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
