"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { AppNav } from "@/components/shared/app-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client";

type QuestionOption = {
  value: number;
  label: string;
  description: string;
};

type WeeklyQuestion = {
  key: string;
  type: "MCQ" | "WRITTEN";
  prompt: string;
  category: "STRENGTH" | "WEAKNESS" | "OPPORTUNITY" | "THREAT";
  sourceTag: "STANDARD" | "SWOT_DYNAMIC";
  linkedSwotTitle?: string;
  minLength?: number;
  placeholder?: string;
  guidance?: string;
  options?: QuestionOption[];
};

type WeeklyResponse = {
  questionnaire: {
    title: string;
    subtitle: string;
    weekLabel: string;
    weekStart: string;
    weekEnd: string;
    standardQuestions: WeeklyQuestion[];
    swotQuestions: WeeklyQuestion[];
    allQuestions: WeeklyQuestion[];
  };
  completion: {
    completedThisWeek: boolean;
    weekStart: string;
    weekEnd: string;
    submittedAt: string | null;
  };
  existingAnswers: Array<{
    questionKey: string;
    answerScore: number | null;
    answerText: string | null;
  }>;
  history: Array<{
    id: string;
    weekStart: string;
    weekEnd: string;
    overallScore: number;
    strengthsScore: number;
    weaknessesScore: number;
    opportunitiesScore: number;
    threatsScore: number;
    summary: string;
  }>;
};

type DraftAnswer = {
  answerScore?: number;
  answerText?: string;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildDraftAnswers(response: WeeklyResponse | null) {
  if (!response) return {};

  const nextDraft: Record<string, DraftAnswer> = {};
  for (const answer of response.existingAnswers) {
    nextDraft[answer.questionKey] = {
      answerScore: answer.answerScore ?? undefined,
      answerText: answer.answerText ?? undefined,
    };
  }
  return nextDraft;
}

function answerSatisfied(question: WeeklyQuestion, answer?: DraftAnswer) {
  if (!answer) return false;
  if (question.type === "MCQ") {
    return typeof answer.answerScore === "number";
  }
  const minLength = question.minLength ?? 20;
  return (answer.answerText?.trim().length ?? 0) >= minLength;
}

function firstIncompleteIndex(questions: WeeklyQuestion[], answers: Record<string, DraftAnswer>) {
  const index = questions.findIndex((question) => !answerSatisfied(question, answers[question.key]));
  return index === -1 ? 0 : index;
}

function categoryTone(category: WeeklyQuestion["category"]) {
  if (category === "STRENGTH") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (category === "WEAKNESS") return "text-amber-700 bg-amber-50 border-amber-200";
  if (category === "OPPORTUNITY") return "text-sky-700 bg-sky-50 border-sky-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export function WeeklyAssessmentSurface() {
  const [data, setData] = useState<WeeklyResponse | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, DraftAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const response = await apiFetch<WeeklyResponse>("/api/weekly-assessments");
    const nextDraft = buildDraftAnswers(response);
    setData(response);
    setDraftAnswers(nextDraft);
    setCurrentIndex(firstIncompleteIndex(response.questionnaire.allQuestions, nextDraft));
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await apiFetch<WeeklyResponse>("/api/weekly-assessments");
        const nextDraft = buildDraftAnswers(response);
        if (!cancelled) {
          setData(response);
          setDraftAnswers(nextDraft);
          setCurrentIndex(firstIncompleteIndex(response.questionnaire.allQuestions, nextDraft));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load weekly assessment",
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

  function updateAnswer(questionKey: string, value: DraftAnswer) {
    setDraftAnswers((current) => ({
      ...current,
      [questionKey]: {
        ...current[questionKey],
        ...value,
      },
    }));
  }

  async function handleSubmit() {
    if (!data) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch("/api/weekly-assessments", {
        method: "POST",
        body: JSON.stringify({
          answers: data.questionnaire.allQuestions.map((question) => ({
            questionKey: question.key,
            answerScore: draftAnswers[question.key]?.answerScore,
            answerText: draftAnswers[question.key]?.answerText,
          })),
        }),
      });

      setSuccess("Weekly assessment saved. SWOT state and progress history were refreshed.");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit weekly assessment",
      );
    } finally {
      setSaving(false);
    }
  }

  const allQuestions = data?.questionnaire.allQuestions ?? [];
  const currentQuestion = allQuestions[currentIndex];
  const currentAnswer = currentQuestion ? draftAnswers[currentQuestion.key] : undefined;
  const completedCount = allQuestions.filter((question) =>
    answerSatisfied(question, draftAnswers[question.key]),
  ).length;
  const progress = allQuestions.length === 0 ? 0 : completedCount / allQuestions.length;
  const latestHistory = data?.history[data.history.length - 1] ?? null;
  const isLastQuestion = currentIndex === allQuestions.length - 1;
  const canAdvance = currentQuestion ? answerSatisfied(currentQuestion, currentAnswer) : false;

  function handleNext() {
    if (!canAdvance || !currentQuestion) return;
    if (isLastQuestion) {
      void handleSubmit();
      return;
    }
    setCurrentIndex((index) => Math.min(index + 1, allQuestions.length - 1));
  }

  function handlePrevious() {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f7f8_0%,#eef7f4_100%)]">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="overflow-hidden border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(0,120,106,0.18),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,255,250,0.95))] p-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/70 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <ClipboardList size={12} />
              Weekly Assessment Test
            </div>
            <h1 className="max-w-3xl text-3xl font-bold text-[var(--text)]">
              A dedicated weekly test, separate from chat, with fixed questions and SWOT-based follow-ups.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-black/58">
              The student answers one question at a time like a real assessment. Standard questions stay consistent every week, while extra questions adapt to the current SWOT profile.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">This Week</p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {loading ? "..." : data?.questionnaire.weekLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">Questions</p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {loading ? "..." : allQuestions.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">Completed</p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {loading ? "..." : `${completedCount}/${allQuestions.length}`}
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[var(--brand)]" />
                  <p className="text-sm font-semibold text-[var(--text)]">Assessment Progress</p>
                </div>
                <span className="text-xs font-semibold text-black/45">
                  {loading ? "..." : percent(progress)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/8">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand),#14b8a6)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progress * 100, 4)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="mt-3 text-sm text-black/55">
                {loading
                  ? "Loading assessment..."
                  : data?.completion.completedThisWeek
                    ? `This week's assessment was already submitted${data.completion.submittedAt ? ` on ${format(new Date(data.completion.submittedAt), "dd MMM, hh:mm a")}` : ""}. You can review or update it here.`
                    : "This week's assessment is pending. Complete each question in sequence and submit at the end."}
              </p>
            </Card>

            {latestHistory && (
              <Card className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-amber-700" />
                  <p className="text-sm font-semibold text-[var(--text)]">Latest Weekly Snapshot</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">
                  {format(new Date(latestHistory.weekStart), "dd MMM")} - {format(new Date(latestHistory.weekEnd), "dd MMM")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-black/58">{latestHistory.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    Strengths {percent(latestHistory.strengthsScore)}
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                    Weaknesses {percent(latestHistory.weaknessesScore)}
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                    Opportunities {percent(latestHistory.opportunitiesScore)}
                  </div>
                  <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    Threats {percent(latestHistory.threatsScore)}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-black/45">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading assessment...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {!loading && data && currentQuestion && (
          <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <Card className="overflow-hidden border-black/8 bg-white/94 p-5">
              <div className="mb-4 flex items-center gap-2">
                <BookCheck size={16} className="text-[var(--brand)]" />
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Question Navigator</h2>
                  <p className="text-xs text-black/45">Move through the test one question at a time</p>
                </div>
              </div>
              <div className="space-y-2">
                {allQuestions.map((question, index) => {
                  const isActive = index === currentIndex;
                  const done = answerSatisfied(question, draftAnswers[question.key]);
                  return (
                    <button
                      key={question.key}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-[var(--brand)] bg-[var(--brand)]/8"
                          : "border-black/8 bg-white hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            done
                              ? "bg-emerald-100 text-emerald-700"
                              : isActive
                                ? "bg-[var(--brand)] text-white"
                                : "bg-black/6 text-black/55"
                          }`}
                        >
                          {done ? <CheckCircle2 size={14} /> : index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{question.prompt}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-black/35">
                            {question.sourceTag === "STANDARD" ? "Standard" : "SWOT-based"} • {question.category}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="overflow-hidden border-emerald-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,255,252,0.96))] p-0">
              <div className="border-b border-black/8 px-6 py-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/55">
                    Question {currentIndex + 1} of {allQuestions.length}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${categoryTone(currentQuestion.category)}`}>
                    {currentQuestion.category}
                  </span>
                  <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/55">
                    {currentQuestion.sourceTag === "STANDARD" ? "Standard Question" : "SWOT-Based Question"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold leading-snug text-[var(--text)]">
                  {currentQuestion.prompt}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-black/55">
                  {currentQuestion.sourceTag === "SWOT_DYNAMIC"
                    ? `This question was generated from your current SWOT item${currentQuestion.linkedSwotTitle ? `: ${currentQuestion.linkedSwotTitle}` : ""}.`
                    : "This is part of the standard weekly assessment that every student answers."}
                </p>
              </div>

              <div className="px-6 py-6">
                {currentQuestion.type === "MCQ" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentQuestion.options?.map((option) => {
                      const active = currentAnswer?.answerScore === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() =>
                            updateAnswer(currentQuestion.key, { answerScore: option.value })
                          }
                          className={`rounded-3xl border px-5 py-4 text-left transition ${
                            active
                              ? "border-[var(--brand)] bg-[var(--brand)]/8 shadow-[0_18px_40px_-28px_rgba(0,120,106,0.55)]"
                              : "border-black/8 bg-white hover:border-black/20"
                          }`}
                        >
                          <p className="text-base font-semibold text-[var(--text)]">{option.label}</p>
                          <p className="mt-2 text-sm leading-relaxed text-black/55">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <Textarea
                      value={currentAnswer?.answerText ?? ""}
                      onChange={(event) =>
                        updateAnswer(currentQuestion.key, { answerText: event.target.value })
                      }
                      placeholder={currentQuestion.placeholder}
                      className="min-h-48 border-black/10 px-4 py-3 text-base"
                    />
                    <p className="mt-3 text-sm text-black/50">{currentQuestion.guidance}</p>
                    <p className="mt-2 text-xs font-medium text-black/35">
                      Minimum {currentQuestion.minLength ?? 20} characters
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 bg-black/[0.02] px-6 py-4">
                <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0 || saving}>
                  <ArrowLeft size={15} className="mr-2" />
                  Previous
                </Button>
                <div className="text-sm leading-relaxed text-black/50">
                  {canAdvance
                    ? isLastQuestion
                      ? "You are on the final question. Submit when ready."
                      : "Answer saved locally. Move to the next question."
                    : "Complete this question before moving forward."}
                </div>
                <Button onClick={handleNext} disabled={!canAdvance || saving}>
                  {saving ? (
                    <>
                      <Loader2 size={15} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : isLastQuestion ? (
                    <>
                      <Sparkles size={15} className="mr-2" />
                      Submit Assessment
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={15} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
