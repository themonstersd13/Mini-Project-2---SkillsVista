import { startOfWeek, endOfWeek, format } from "date-fns";
import type { SWOTCategory } from "@prisma/client";

export type WeeklyQuestionOption = {
  value: number;
  label: string;
  description: string;
};

type WeeklyQuestionBase = {
  key: string;
  prompt: string;
  category: SWOTCategory;
  dimensionKey: string;
  weight: number;
  sourceTag: "STANDARD" | "SWOT_DYNAMIC";
};

export type WeeklySignal = {
  category: SWOTCategory;
  title: string;
  description: string;
};

export type WeeklyMcqQuestion = WeeklyQuestionBase & {
  type: "MCQ";
  tone: "positive" | "risk";
  options: WeeklyQuestionOption[];
  linkedSwotItemId?: string;
  linkedSwotTitle?: string;
  highSignal?: WeeklySignal;
  lowSignal?: WeeklySignal;
};

export type WeeklyWrittenQuestion = WeeklyQuestionBase & {
  type: "WRITTEN";
  minLength: number;
  placeholder: string;
  guidance: string;
  linkedSwotItemId?: string;
  linkedSwotTitle?: string;
};

export type WeeklyQuestion = WeeklyMcqQuestion | WeeklyWrittenQuestion;

export type WeeklyQuestionnaire = {
  title: string;
  subtitle: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  standardQuestions: WeeklyQuestion[];
  swotQuestions: WeeklyQuestion[];
  allQuestions: WeeklyQuestion[];
};

export type WeeklyAnswerInput = {
  questionKey: string;
  answerScore?: number;
  answerText?: string;
};

export type WeeklyAssessmentSnapshot = {
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  weekLabel: string;
};

export type WeeklySwotSeed = {
  id: string;
  title: string;
  category: SWOTCategory;
  description: string;
  confidence: number;
  status: "ACTIVE" | "UNCERTAIN" | "STALE" | "RETIRED";
};

export type WeeklyEvaluation = {
  metrics: {
    overallScore: number;
    strengthsScore: number;
    weaknessesScore: number;
    opportunitiesScore: number;
    threatsScore: number;
  };
  summary: string;
  recommendations: string[];
  answers: Array<{
    question: WeeklyQuestion;
    answerScore?: number;
    answerText?: string;
    optionLabel?: string;
  }>;
  genericSignals: Array<{
    category: SWOTCategory;
    title: string;
    description: string;
    confidence: number;
    evidenceExcerpt: string;
  }>;
  linkedSwotUpdates: Array<{
    swotItemId: string;
    swotTitle: string;
    category: SWOTCategory;
    confidenceDelta: number;
    evidenceExcerpt: string;
  }>;
};

export const weeklyScoreOptions: WeeklyQuestionOption[] = [
  {
    value: 1,
    label: "Rarely",
    description: "This barely showed up for me this week.",
  },
  {
    value: 2,
    label: "Sometimes",
    description: "It showed up, but not consistently.",
  },
  {
    value: 3,
    label: "Often",
    description: "It affected my week in a noticeable way.",
  },
  {
    value: 4,
    label: "Strongly",
    description: "This was a clear pattern throughout the week.",
  },
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeScore(score: number) {
  return (score - 1) / 3;
}

function buildWeekRange(referenceDate = new Date()) {
  const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const end = endOfWeek(referenceDate, { weekStartsOn: 1 });

  return {
    start,
    end,
    label: `${format(start, "dd MMM")} - ${format(end, "dd MMM")}`,
  };
}

function createStandardQuestions(): WeeklyQuestion[] {
  return [
    {
      key: "weekly-discipline",
      type: "MCQ",
      prompt: "How consistently did you follow your important routine or commitments this week?",
      category: "STRENGTH",
      dimensionKey: "discipline",
      weight: 1.2,
      sourceTag: "STANDARD",
      tone: "positive",
      options: weeklyScoreOptions,
      highSignal: {
        category: "STRENGTH",
        title: "Weekly self-discipline",
        description: "Shows repeatable discipline and follow-through in weekly routines.",
      },
      lowSignal: {
        category: "WEAKNESS",
        title: "Weekly routine inconsistency",
        description: "Routine discipline is slipping and needs more structure.",
      },
    },
    {
      key: "weekly-confidence",
      type: "MCQ",
      prompt: "How confidently did you speak up, ask for help, or express your thoughts this week?",
      category: "STRENGTH",
      dimensionKey: "communication",
      weight: 1,
      sourceTag: "STANDARD",
      tone: "positive",
      options: weeklyScoreOptions,
      highSignal: {
        category: "STRENGTH",
        title: "Weekly communication confidence",
        description: "Expresses needs and ideas with growing confidence.",
      },
      lowSignal: {
        category: "WEAKNESS",
        title: "Weekly hesitation in self-expression",
        description: "Confidence in speaking up still needs support.",
      },
    },
    {
      key: "weekly-support",
      type: "MCQ",
      prompt: "How well did you use people, mentors, friends, or useful opportunities around you this week?",
      category: "OPPORTUNITY",
      dimensionKey: "support-use",
      weight: 1,
      sourceTag: "STANDARD",
      tone: "positive",
      options: weeklyScoreOptions,
      highSignal: {
        category: "OPPORTUNITY",
        title: "Weekly support-system usage",
        description: "Makes practical use of mentors, peers, and helpful environments.",
      },
      lowSignal: {
        category: "THREAT",
        title: "Underused support system",
        description: "Helpful support exists but is not being used consistently.",
      },
    },
    {
      key: "weekly-overwhelm",
      type: "MCQ",
      prompt: "How strongly did stress, overwhelm, or pressure affect your weekly progress?",
      category: "THREAT",
      dimensionKey: "overwhelm",
      weight: 1.1,
      sourceTag: "STANDARD",
      tone: "risk",
      options: weeklyScoreOptions,
      highSignal: {
        category: "THREAT",
        title: "Weekly overwhelm pressure",
        description: "Stress or pressure is actively affecting weekly performance.",
      },
      lowSignal: {
        category: "STRENGTH",
        title: "Weekly emotional steadiness",
        description: "Stayed comparatively calm and steady despite pressure.",
      },
    },
    {
      key: "weekly-avoidance",
      type: "MCQ",
      prompt: "How much did procrastination, avoidance, or low focus reduce your output this week?",
      category: "WEAKNESS",
      dimensionKey: "avoidance",
      weight: 1.1,
      sourceTag: "STANDARD",
      tone: "risk",
      options: weeklyScoreOptions,
      highSignal: {
        category: "WEAKNESS",
        title: "Weekly avoidance pattern",
        description: "Avoidance or low focus is visibly reducing execution quality.",
      },
      lowSignal: {
        category: "STRENGTH",
        title: "Weekly focus stability",
        description: "Stayed comparatively focused and avoided unnecessary drift.",
      },
    },
    {
      key: "weekly-win",
      type: "WRITTEN",
      prompt: "Describe one non-technical win from this week that reflects your growth.",
      category: "STRENGTH",
      dimensionKey: "reflection",
      weight: 1,
      sourceTag: "STANDARD",
      minLength: 20,
      placeholder: "Example: I handled a difficult conversation more calmly than I would have earlier.",
      guidance: "Focus on behavior, attitude, confidence, or routine rather than marks or coding only.",
    },
    {
      key: "weekly-blocker",
      type: "WRITTEN",
      prompt: "Describe the biggest personal blocker that affected you this week.",
      category: "WEAKNESS",
      dimensionKey: "reflection",
      weight: 1,
      sourceTag: "STANDARD",
      minLength: 20,
      placeholder: "Example: I delayed starting work because I felt mentally overloaded and uncertain.",
      guidance: "Be direct about what slowed you down so the SWOT state can be updated honestly.",
    },
    {
      key: "weekly-next-step",
      type: "WRITTEN",
      prompt: "What support, habit, or opportunity would help you most next week?",
      category: "OPPORTUNITY",
      dimensionKey: "reflection",
      weight: 1,
      sourceTag: "STANDARD",
      minLength: 20,
      placeholder: "Example: A mentor check-in and a more realistic weekly plan would help me most.",
      guidance: "Keep it practical and usable for next week's review.",
    },
  ];
}

function buildDynamicQuestion(item: WeeklySwotSeed): WeeklyQuestion[] {
  if (item.category === "STRENGTH" || item.category === "OPPORTUNITY") {
    return [
      {
        key: `swot-${item.id}-usage`,
        type: "MCQ",
        prompt: `How strongly did you use "${item.title}" in your week?`,
        category: item.category,
        dimensionKey: item.title,
        weight: 1.15,
        sourceTag: "SWOT_DYNAMIC",
        tone: "positive",
        linkedSwotItemId: item.id,
        linkedSwotTitle: item.title,
        options: weeklyScoreOptions,
      },
      {
        key: `swot-${item.id}-example`,
        type: "WRITTEN",
        prompt: `Give one brief example of how "${item.title}" helped you this week.`,
        category: item.category,
        dimensionKey: item.title,
        weight: 0.9,
        sourceTag: "SWOT_DYNAMIC",
        linkedSwotItemId: item.id,
        linkedSwotTitle: item.title,
        minLength: 16,
        placeholder: `Example: ${item.title} helped me stay calmer and more effective in one key situation.`,
        guidance: "Use a real moment from this week if possible.",
      },
    ];
  }

  return [
    {
      key: `swot-${item.id}-impact`,
      type: "MCQ",
      prompt: `How strongly did "${item.title}" affect your progress this week?`,
      category: item.category,
      dimensionKey: item.title,
      weight: 1.15,
      sourceTag: "SWOT_DYNAMIC",
      tone: "risk",
      linkedSwotItemId: item.id,
      linkedSwotTitle: item.title,
      options: weeklyScoreOptions,
    },
    {
      key: `swot-${item.id}-trigger`,
      type: "WRITTEN",
      prompt: `What triggered or reinforced "${item.title}" this week?`,
      category: item.category,
      dimensionKey: item.title,
      weight: 0.9,
      sourceTag: "SWOT_DYNAMIC",
      linkedSwotItemId: item.id,
      linkedSwotTitle: item.title,
      minLength: 16,
      placeholder: `Example: ${item.title} became visible when I was under pressure or avoided something important.`,
      guidance: "A small but honest example is enough.",
    },
  ];
}

export function buildWeeklyQuestionnaire(swotItems: WeeklySwotSeed[], referenceDate = new Date()): WeeklyQuestionnaire {
  const weekRange = buildWeekRange(referenceDate);
  const standardQuestions = createStandardQuestions();

  const dynamicSeeds = swotItems
    .filter((item) => item.status !== "RETIRED")
    .sort((left, right) => right.confidence - left.confidence);

  const pickOne = (category: SWOTCategory) =>
    dynamicSeeds.find((item) => item.category === category);

  const selectedDynamicItems = [
    pickOne("WEAKNESS"),
    pickOne("THREAT"),
    pickOne("STRENGTH"),
    pickOne("OPPORTUNITY"),
  ].filter(Boolean) as WeeklySwotSeed[];

  const swotQuestions = selectedDynamicItems.flatMap((item) =>
    buildDynamicQuestion(item),
  );

  return {
    title: "Weekly SWOT Assessment",
    subtitle: "A separate weekly review with standard questions and personalized SWOT follow-ups.",
    weekLabel: weekRange.label,
    weekStart: weekRange.start.toISOString(),
    weekEnd: weekRange.end.toISOString(),
    standardQuestions,
    swotQuestions,
    allQuestions: [...standardQuestions, ...swotQuestions],
  };
}

function buildMcqEvidence(question: WeeklyMcqQuestion, score: number, optionLabel: string) {
  return `${question.prompt} Answer: ${optionLabel} (${score}/4).`;
}

export function evaluateWeeklyAssessment(
  questionnaire: WeeklyQuestionnaire,
  answersInput: WeeklyAnswerInput[],
  previous?: WeeklyAssessmentSnapshot,
): WeeklyEvaluation {
  const answerMap = new Map(answersInput.map((answer) => [answer.questionKey, answer]));
  const answers: WeeklyEvaluation["answers"] = [];
  const strengths: number[] = [];
  const weaknesses: number[] = [];
  const opportunities: number[] = [];
  const threats: number[] = [];
  const genericSignals: WeeklyEvaluation["genericSignals"] = [];
  const linkedSwotUpdates: WeeklyEvaluation["linkedSwotUpdates"] = [];
  const writtenEvidence = new Map<string, string>();

  for (const question of questionnaire.allQuestions) {
    const incoming = answerMap.get(question.key);
    if (!incoming) {
      throw new Error(`Missing answer for "${question.prompt}"`);
    }

    if (question.type === "WRITTEN") {
      const text = incoming.answerText?.trim() ?? "";
      if (text.length < question.minLength) {
        throw new Error(`Question "${question.prompt}" requires at least ${question.minLength} characters.`);
      }

      answers.push({
        question,
        answerText: text,
      });

      if (question.linkedSwotItemId) {
        writtenEvidence.set(question.linkedSwotItemId, text);
      }
      continue;
    }

    if (typeof incoming.answerScore !== "number") {
      throw new Error(`Question "${question.prompt}" requires an MCQ answer.`);
    }

    const option = question.options.find((entry) => entry.value === incoming.answerScore);
    if (!option) {
      throw new Error(`Question "${question.prompt}" has an invalid answer option.`);
    }

    const normalized = normalizeScore(incoming.answerScore);
    answers.push({
      question,
      answerScore: incoming.answerScore,
      optionLabel: option.label,
    });

    if (question.category === "STRENGTH") strengths.push(normalized);
    if (question.category === "WEAKNESS") weaknesses.push(normalized);
    if (question.category === "OPPORTUNITY") opportunities.push(normalized);
    if (question.category === "THREAT") threats.push(normalized);

    if (question.sourceTag === "STANDARD") {
      const shouldUseHighSignal = question.tone === "positive" ? normalized >= 0.6 : normalized >= 0.7;
      const shouldUseLowSignal = question.tone === "positive" ? normalized <= 0.3 : normalized <= 0.2;
      const signal = shouldUseHighSignal
        ? question.highSignal
        : shouldUseLowSignal
          ? question.lowSignal
          : undefined;

      if (signal) {
        genericSignals.push({
          category: signal.category,
          title: signal.title,
          description: signal.description,
          confidence: round2(0.58 + normalized * 0.28),
          evidenceExcerpt: buildMcqEvidence(question, incoming.answerScore, option.label),
        });
      }
    }

    if (question.sourceTag === "SWOT_DYNAMIC" && question.linkedSwotItemId && question.linkedSwotTitle) {
      const confidenceDelta =
        question.tone === "positive"
          ? round2((normalized - 0.5) * 0.22)
          : round2((normalized - 0.35) * 0.22);

      linkedSwotUpdates.push({
        swotItemId: question.linkedSwotItemId,
        swotTitle: question.linkedSwotTitle,
        category: question.category,
        confidenceDelta,
        evidenceExcerpt: buildMcqEvidence(question, incoming.answerScore, option.label),
      });
    }
  }

  for (const update of linkedSwotUpdates) {
    const linkedReflection = writtenEvidence.get(update.swotItemId);
    if (linkedReflection) {
      update.evidenceExcerpt = `${update.evidenceExcerpt} Reflection: ${linkedReflection}`;
    }
  }

  const metrics = {
    strengthsScore: round2(average(strengths)),
    weaknessesScore: round2(average(weaknesses)),
    opportunitiesScore: round2(average(opportunities)),
    threatsScore: round2(average(threats)),
    overallScore: 0,
  };

  metrics.overallScore = round2(
    average([
      metrics.strengthsScore,
      metrics.opportunitiesScore,
      1 - metrics.weaknessesScore,
      1 - metrics.threatsScore,
    ]),
  );

  const summaryParts = [
    `Weekly assessment for ${questionnaire.weekLabel} shows strongest movement in ${
      metrics.strengthsScore >= metrics.opportunitiesScore ? "strengths" : "opportunities"
    } and the biggest drag in ${
      metrics.weaknessesScore >= metrics.threatsScore ? "weaknesses" : "threats"
    }.`,
  ];

  if (previous) {
    const delta = metrics.overallScore - previous.overallScore;
    if (delta >= 0.08) {
      summaryParts.push("Compared with last week, the student shows a clear improvement in weekly balance.");
    } else if (delta <= -0.08) {
      summaryParts.push("Compared with last week, weekly balance has dropped and needs attention before patterns harden.");
    } else {
      summaryParts.push("Compared with last week, the profile is fairly stable with only small movement.");
    }
  }

  const recommendations: string[] = [];
  if (metrics.weaknessesScore >= 0.66) {
    recommendations.push("Reduce one avoidable blocker next week and keep the target concrete.");
  }
  if (metrics.threatsScore >= 0.66) {
    recommendations.push("Use one check-in with a mentor, teacher, or friend before the pressure builds.");
  }
  if (metrics.opportunitiesScore < 0.45) {
    recommendations.push("Make better use of one available support system next week.");
  }
  if (metrics.strengthsScore < 0.45) {
    recommendations.push("Protect one small routine that reliably gives structure and confidence.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Keep the weekly assessment habit so progress is tracked even without daily chat activity.");
  }

  return {
    metrics,
    summary: summaryParts.join(" "),
    recommendations,
    answers,
    genericSignals,
    linkedSwotUpdates,
  };
}

export function getWeeklyAssessmentWindow(referenceDate = new Date()) {
  return buildWeekRange(referenceDate);
}
