"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChartColumnBig,
  ClipboardCheck,
  Compass,
  GraduationCap,
  LineChart,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/shared/app-nav";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/client";

type YearlyPoint = {
  stage: "FY" | "SY" | "TY" | "LY";
  stageLabel: string;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  narrative: string;
  takenAt: string;
};

type ReportsAssessmentResponse = {
  assessments: Array<{
    id: string;
    academicStage: "FY" | "SY" | "TY" | "LY";
    title: string;
    overallScore: number;
    strengthsScore: number;
    weaknessesScore: number;
    opportunitiesScore: number;
    threatsScore: number;
    narrative: string;
    recommendations: string[];
    takenAt: string;
  }>;
  report: {
    timeline: YearlyPoint[];
    completedStages: number;
    completionRatio: number;
    evolutionSummary: string;
    strongestImprovement: string;
    keyRisk: string;
  };
};

type WeeklyHistoryPoint = {
  id: string;
  weekStart: string;
  weekEnd: string;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  summary: string;
};

type WeeklyReportResponse = {
  history: WeeklyHistoryPoint[];
  completion: {
    completedThisWeek: boolean;
    submittedAt: string | null;
  };
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildLinePath(points: Array<{ value: number; label: string; key: string }>, width: number, height: number) {
  const padX = 24;
  const padY = 20;
  const plotted = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - point.value * (height - padY * 2);
    return { ...point, x, y };
  });

  return {
    plotted,
    path: plotted
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" "),
  };
}

function ReportLineChart({
  title,
  subtitle,
  color,
  points,
}: {
  title: string;
  subtitle: string;
  color: string;
  points: Array<{ key: string; label: string; value: number }>;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/12 bg-white/80 px-4 py-8 text-center text-sm text-black/45">
        No report points available yet.
      </div>
    );
  }

  const { plotted, path } = buildLinePath(points, 360, 168);

  return (
    <div className="rounded-[30px] border border-black/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(245,250,255,0.96))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
          <p className="text-xs text-black/45">{subtitle}</p>
        </div>
        <LineChart size={16} className="text-[var(--brand)]" />
      </div>
      <svg viewBox="0 0 360 168" className="h-44 w-full">
        {[0.25, 0.5, 0.75].map((line) => {
          const y = 168 - 20 - line * (168 - 40);
          return <line key={line} x1="20" x2="340" y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeDasharray="4 5" />;
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        {plotted.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="5.5" fill={color} />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="10" fill="rgba(15,23,42,0.7)">
              {percent(point.value)}
            </text>
            <text x={point.x} y="160" textAnchor="middle" fontSize="10" fill="rgba(15,23,42,0.7)">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CategoryComparison({
  title,
  point,
  accentLabel,
}: {
  title: string;
  point: {
    strengthsScore: number;
    weaknessesScore: number;
    opportunitiesScore: number;
    threatsScore: number;
  } | null;
  accentLabel: string;
}) {
  if (!point) {
    return (
      <div className="rounded-3xl border border-dashed border-black/12 bg-white/80 px-4 py-8 text-center text-sm text-black/45">
        Complete more assessments to populate this chart.
      </div>
    );
  }

  const bars = [
    { label: "Strengths", value: point.strengthsScore, color: "bg-emerald-500" },
    { label: "Weaknesses", value: point.weaknessesScore, color: "bg-amber-500" },
    { label: "Opportunities", value: point.opportunitiesScore, color: "bg-sky-500" },
    { label: "Threats", value: point.threatsScore, color: "bg-rose-500" },
  ];

  return (
    <div className="rounded-[30px] border border-black/8 bg-white/92 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
          <p className="text-xs text-black/45">{accentLabel}</p>
        </div>
        <ChartColumnBig size={16} className="text-[var(--brand)]" />
      </div>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-black/60">
              <span>{bar.label}</span>
              <span>{percent(bar.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/8">
              <motion.div
                className={`h-full rounded-full ${bar.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(bar.value * 100, 6)}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressReportSurface() {
  const [yearly, setYearly] = useState<ReportsAssessmentResponse | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [yearlyResponse, weeklyResponse] = await Promise.all([
          apiFetch<ReportsAssessmentResponse>("/api/assessments"),
          apiFetch<WeeklyReportResponse>("/api/weekly-assessments"),
        ]);

        if (!cancelled) {
          setYearly(yearlyResponse);
          setWeekly(weeklyResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load reports",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const latestYearly = yearly?.report.timeline[yearly.report.timeline.length - 1] ?? null;
  const latestWeekly = weekly?.history[weekly.history.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
              <BarChart3 size={12} />
              Progress Report
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Dedicated progress report</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/55">
              This route is only for reporting. It combines yearly SWOT evolution and weekly assessment consistency with graphs, charts, and teacher-friendly summaries.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="min-w-[180px] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Yearly Milestones</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">
                {loading ? "..." : `${yearly?.report.completedStages ?? 0}/4`}
              </p>
            </Card>
            <Card className="min-w-[180px] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Latest Yearly Score</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">
                {loading ? "..." : latestYearly ? percent(latestYearly.overallScore) : "--"}
              </p>
            </Card>
            <Card className="min-w-[180px] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Latest Weekly Score</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">
                {loading ? "..." : latestWeekly ? percent(latestWeekly.overallScore) : "--"}
              </p>
            </Card>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-black/45">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading report visuals...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && yearly && weekly && (
          <div className="space-y-6">
            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="overflow-hidden border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(0,120,106,0.16),_transparent_38%),linear-gradient(135deg,rgba(246,255,252,0.98),rgba(255,255,255,0.96))] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <GraduationCap size={17} className="text-emerald-700" />
                  <div>
                    <p className="text-lg font-bold text-[var(--text)]">Year-wise evolution report</p>
                    <p className="text-sm text-black/55">FY to LY analysis of how the student evolved</p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <ReportLineChart
                    title="Yearly Growth Curve"
                    subtitle="Overall structured SWOT score across academic years"
                    color="rgba(0,120,106,0.88)"
                    points={yearly.report.timeline.map((point) => ({
                      key: point.stage,
                      label: point.stage,
                      value: point.overallScore,
                    }))}
                  />
                  <CategoryComparison
                    title="Latest Yearly SWOT Balance"
                    accentLabel={latestYearly ? `${latestYearly.stageLabel} snapshot` : "No yearly snapshot yet"}
                    point={latestYearly}
                  />
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Compass size={16} className="text-[var(--brand)]" />
                    <p className="text-sm font-semibold text-[var(--text)]">Teacher Summary</p>
                  </div>
                  <p className="text-sm leading-relaxed text-black/58">
                    {yearly.report.evolutionSummary}
                  </p>
                  <div className="mt-4 space-y-2 rounded-2xl bg-black/[0.03] p-4 text-sm leading-relaxed text-black/58">
                    <p>{yearly.report.strongestImprovement}</p>
                    <p>{yearly.report.keyRisk}</p>
                  </div>
                </Card>
                {latestYearly && (
                  <Card className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles size={15} className="text-emerald-700" />
                      <p className="text-sm font-semibold text-[var(--text)]">Latest yearly narrative</p>
                    </div>
                    <p className="text-sm leading-relaxed text-black/58">{latestYearly.narrative}</p>
                    <p className="mt-3 text-xs text-black/40">
                      Last updated on {format(new Date(latestYearly.takenAt), "dd MMM yyyy")}
                    </p>
                  </Card>
                )}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="overflow-hidden border-sky-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_40%),linear-gradient(135deg,rgba(249,253,255,0.98),rgba(255,255,255,0.96))] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardCheck size={17} className="text-sky-700" />
                  <div>
                    <p className="text-lg font-bold text-[var(--text)]">Weekly assessment consistency</p>
                    <p className="text-sm text-black/55">Separate from chat, tracked through weekly test submissions</p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <ReportLineChart
                    title="Weekly Consistency Graph"
                    subtitle="Overall score for recent weekly assessments"
                    color="rgba(14,165,233,0.9)"
                    points={weekly.history.map((point) => ({
                      key: point.id,
                      label: format(new Date(point.weekStart), "dd MMM"),
                      value: point.overallScore,
                    }))}
                  />
                  <CategoryComparison
                    title="Latest Weekly SWOT Balance"
                    accentLabel={latestWeekly ? `${format(new Date(latestWeekly.weekStart), "dd MMM")} - ${format(new Date(latestWeekly.weekEnd), "dd MMM")}` : "No weekly snapshot yet"}
                    point={latestWeekly}
                  />
                </div>
              </Card>

              <div className="space-y-4">
                {latestWeekly && (
                  <Card className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldAlert size={16} className="text-amber-700" />
                      <p className="text-sm font-semibold text-[var(--text)]">Latest weekly interpretation</p>
                    </div>
                    <p className="text-sm leading-relaxed text-black/58">{latestWeekly.summary}</p>
                  </Card>
                )}
                <Card className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <BarChart3 size={16} className="text-[var(--brand)]" />
                    <p className="text-sm font-semibold text-[var(--text)]">Recent checkpoints</p>
                  </div>
                  <div className="space-y-2">
                    {weekly.history.length === 0 && (
                      <p className="text-sm text-black/45">No weekly checkpoints yet.</p>
                    )}
                    {weekly.history.slice(-4).reverse().map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-black/8 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {format(new Date(entry.weekStart), "dd MMM")} - {format(new Date(entry.weekEnd), "dd MMM")}
                          </p>
                          <span className="rounded-full bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
                            {percent(entry.overallScore)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-black/50">{entry.summary}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
