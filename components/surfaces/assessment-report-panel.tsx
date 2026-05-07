"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { startTransition, useEffect, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  ChartColumnBig,
  CircleAlert,
  Compass,
  GraduationCap,
  LineChart,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  academicStages,
  type AcademicStageCode,
  type AssessmentQuestion,
  type AssessmentQuestionSet,
} from "@/lib/assessment/question-bank";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type AssessmentSummary = {
  id: string;
  academicStage: AcademicStageCode;
  title: string;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  narrative: string;
  recommendations: string[];
  takenAt: string;
  answers?: Array<{
    questionKey: string;
    answerScore: number | null;
    answerText: string | null;
  }>;
};

type ReportPoint = {
  stage: AcademicStageCode;
  stageLabel: string;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  narrative: string;
  takenAt: string;
};

type AssessmentsResponse = {
  questionBank: AssessmentQuestionSet[];
  assessments: AssessmentSummary[];
  report: {
    timeline: ReportPoint[];
    completedStages: number;
    completionRatio: number;
    evolutionSummary: string;
    strongestImprovement: string;
    keyRisk: string;
  };
  nextStage: AcademicStageCode | null;
};

type DraftAnswer = {
  answerScore?: number;
  answerText?: string;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function chartPoints(points: ReportPoint[]) {
  const width = 360;
  const height = 160;
  const padX = 22;
  const padY = 18;

  return points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - point.overallScore * (height - padY * 2);
    return { ...point, x, y };
  });
}

function ProgressLineChart({ points }: { points: ReportPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-white/70 px-4 py-8 text-center text-sm text-black/45">
        Complete the first yearly assessment to unlock the progress graph.
      </div>
    );
  }

  const plotted = chartPoints(points);
  const path = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_50%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(235,255,248,0.92))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Overall Growth Curve</p>
          <p className="text-xs text-black/45">Year-over-year change from FY to LY</p>
        </div>
        <LineChart size={16} className="text-emerald-700" />
      </div>
      <svg viewBox="0 0 360 160" className="h-44 w-full">
        {[0.25, 0.5, 0.75].map((line) => {
          const y = 160 - 18 - line * (160 - 36);
          return <line key={line} x1="18" x2="342" y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeDasharray="4 5" />;
        })}
        <path d={path} fill="none" stroke="rgba(0,120,106,0.85)" strokeWidth="3.5" strokeLinecap="round" />
        {plotted.map((point) => (
          <g key={point.stage}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#00786a" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="10" fill="rgba(15,23,42,0.65)">
              {percent(point.overallScore)}
            </text>
            <text x={point.x} y="154" textAnchor="middle" fontSize="11" fill="rgba(15,23,42,0.75)">
              {point.stage}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function LatestCategoryBars({ point }: { point: ReportPoint | null }) {
  if (!point) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-white/70 px-4 py-8 text-center text-sm text-black/45">
        Latest SWOT category bars will appear after an assessment is completed.
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
    <div className="rounded-[28px] border border-black/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,248,255,0.96))] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Latest SWOT Balance</p>
          <p className="text-xs text-black/45">{point.stageLabel} snapshot</p>
        </div>
        <ChartColumnBig size={16} className="text-sky-700" />
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

function buildDraftAnswers(assessment?: AssessmentSummary | null) {
  if (!assessment?.answers?.length) {
    return {};
  }

  const nextDraft: Record<string, DraftAnswer> = {};
  for (const answer of assessment.answers) {
    nextDraft[answer.questionKey] = {
      answerScore: answer.answerScore ?? undefined,
      answerText: answer.answerText ?? undefined,
    };
  }

  return nextDraft;
}

export function AssessmentReportPanel() {
  const [data, setData] = useState<AssessmentsResponse | null>(null);
  const [selectedStage, setSelectedStage] = useState<AcademicStageCode>("FY");
  const [draftAnswers, setDraftAnswers] = useState<Record<string, DraftAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData(preferredStage?: AcademicStageCode) {
    const next = await apiFetch<AssessmentsResponse>("/api/assessments");
    const stageToUse =
      preferredStage && next.questionBank.some((set) => set.stage === preferredStage)
        ? preferredStage
        : next.nextStage ?? "FY";
    const assessment = next.assessments.find(
      (entry) => entry.academicStage === stageToUse,
    );

    startTransition(() => {
      setData(next);
      setSelectedStage(stageToUse);
      setDraftAnswers(buildDraftAnswers(assessment));
    });
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadData();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load yearly assessment data",
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

  const selectedQuestionSet = data?.questionBank.find((set) => set.stage === selectedStage) ?? null;
  const latestPoint = data?.report.timeline[data.report.timeline.length - 1] ?? null;
  const selectedAssessment =
    data?.assessments.find((assessment) => assessment.academicStage === selectedStage) ?? null;

  function handleStageChange(stage: AcademicStageCode) {
    setSelectedStage(stage);
    const assessment = data?.assessments.find((entry) => entry.academicStage === stage) ?? null;
    setDraftAnswers(buildDraftAnswers(assessment));
    setSuccess(null);
  }

  function updateAnswer(question: AssessmentQuestion, value: DraftAnswer) {
    setDraftAnswers((current) => ({
      ...current,
      [question.key]: {
        ...current[question.key],
        ...value,
      },
    }));
  }

  async function submitSelectedStage() {
    if (!selectedQuestionSet) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        academicStage: selectedStage,
        answers: selectedQuestionSet.questions.map((question) => ({
          questionKey: question.key,
          answerScore: draftAnswers[question.key]?.answerScore,
          answerText: draftAnswers[question.key]?.answerText,
        })),
      };

      await apiFetch("/api/assessments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(`${selectedQuestionSet.title} saved and SWOT report refreshed.`);
      await loadData(selectedStage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save assessment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(0,120,106,0.18),_transparent_40%),linear-gradient(135deg,rgba(246,255,252,0.98),rgba(255,255,255,0.96))] p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <Sparkles size={12} />
                Structured SWOT Report
              </div>
              <h2 className="max-w-2xl text-2xl font-bold text-[var(--text)]">
                Progress from FY to LY, based on yearly assessment instead of chat alone.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/58">
                Each academic year now gets a fixed non-technical questionnaire with MCQ and written responses, so teachers can review how the student evolved over time.
              </p>
            </div>
            <div className="grid min-w-[220px] gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Completed Years</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text)]">
                  {loading ? "..." : `${data?.report.completedStages ?? 0}/4`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Latest Overall</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text)]">
                  {loading ? "..." : latestPoint ? percent(latestPoint.overallScore) : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">Next Review</p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {loading ? "..." : data?.nextStage ?? "Complete"}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-black/45">
              <Loader2 size={16} className="mr-2 animate-spin" />
              Loading report...
            </div>
          ) : (
            <div className="space-y-4">
              <ProgressLineChart points={data?.report.timeline ?? []} />
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <LatestCategoryBars point={latestPoint} />
                <div className="rounded-[28px] border border-black/8 bg-white/88 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Compass size={16} className="text-[var(--brand)]" />
                    <p className="text-sm font-semibold text-[var(--text)]">Evolution Summary</p>
                  </div>
                  <p className="text-sm leading-relaxed text-black/58">
                    {data?.report.evolutionSummary}
                  </p>
                  <div className="mt-4 space-y-2 rounded-2xl bg-black/[0.03] p-4 text-xs leading-relaxed text-black/58">
                    <p>{data?.report.strongestImprovement}</p>
                    <p>{data?.report.keyRisk}</p>
                  </div>
                  {latestPoint && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Latest Narrative
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-900/85">
                        {latestPoint.narrative}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(252,249,244,0.96))] p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/55">
                <BookOpenCheck size={12} />
                Yearly Assessment
              </div>
              <h3 className="text-xl font-bold text-[var(--text)]">Structured Review Form</h3>
              <p className="mt-1 text-sm text-black/55">
                Use this when the student needs a milestone review instead of a daily update.
              </p>
            </div>
            <GraduationCap size={18} className="text-[var(--brand)]" />
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2">
            {academicStages.map((stage) => {
              const isActive = stage === selectedStage;
              const completed = data?.assessments.some((assessment) => assessment.academicStage === stage);
              return (
                <button
                  key={stage}
                  onClick={() => handleStageChange(stage)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-black/10 bg-white text-black/65 hover:border-black/20"
                  }`}
                >
                  {stage}
                  <span className={`ml-1 text-[10px] ${isActive ? "text-white/80" : completed ? "text-emerald-600" : "text-black/30"}`}>
                    {completed ? "done" : "new"}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedQuestionSet && (
            <div className="mb-5 rounded-3xl border border-black/8 bg-white/85 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-[var(--text)]">{selectedQuestionSet.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-black/55">{selectedQuestionSet.description}</p>
                </div>
                {selectedAssessment && (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                    Saved {format(new Date(selectedAssessment.takenAt), "dd MMM yyyy")}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex min-h-40 items-center justify-center text-sm text-black/45">
              <Loader2 size={16} className="mr-2 animate-spin" />
              Loading questionnaire...
            </div>
          )}

          {!loading && selectedQuestionSet && (
            <div className="space-y-4">
              {selectedQuestionSet.questions.map((question, index) => (
                <div key={question.key} className="rounded-3xl border border-black/8 bg-white/85 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)]/10 text-sm font-bold text-[var(--brand)]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-relaxed text-[var(--text)]">
                        {question.prompt}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-black/35">
                        {question.type} • {question.category}
                      </p>
                    </div>
                  </div>

                  {question.type === "MCQ" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.options.map((option) => {
                        const active = draftAnswers[question.key]?.answerScore === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => updateAnswer(question, { answerScore: option.value })}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              active
                                ? "border-[var(--brand)] bg-[var(--brand)]/8 shadow-[0_16px_35px_-28px_rgba(0,120,106,0.6)]"
                                : "border-black/8 bg-white hover:border-black/20"
                            }`}
                          >
                            <p className="text-sm font-semibold text-[var(--text)]">{option.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-black/50">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <Textarea
                        value={draftAnswers[question.key]?.answerText ?? ""}
                        onChange={(event) => updateAnswer(question, { answerText: event.target.value })}
                        placeholder={question.placeholder}
                        className="min-h-28"
                      />
                      <p className="mt-2 text-xs text-black/45">{question.guidance}</p>
                    </div>
                  )}
                </div>
              ))}

              {selectedAssessment?.recommendations?.length ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CircleAlert size={15} className="text-amber-700" />
                    <p className="text-sm font-semibold text-amber-900">Current recommendations for this year</p>
                  </div>
                  <div className="space-y-1 text-sm leading-relaxed text-amber-900/80">
                    {selectedAssessment.recommendations.map((recommendation) => (
                      <p key={recommendation}>• {recommendation}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs leading-relaxed text-black/45">
                  Saving this review updates yearly report data and can also refresh SWOT evidence even without daily chat entries.
                </div>
                <Button onClick={submitSelectedStage} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={15} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <BarChart3 size={15} className="mr-2" />
                      Save Yearly Review
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
