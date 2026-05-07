import {
  getAssessmentQuestionSet,
  getStageMetadata,
  type AcademicStageCode,
  type AssessmentQuestion,
  type AssessmentSignal,
  type McqQuestion,
} from "@/lib/assessment/question-bank";

export type AssessmentAnswerInput = {
  questionKey: string;
  answerScore?: number;
  answerText?: string;
};

export type ValidatedAssessmentAnswer = {
  question: AssessmentQuestion;
  answerScore?: number;
  answerText?: string;
  optionLabel?: string;
};

export type AssessmentSignalUpdate = {
  category: AssessmentSignal["category"];
  title: string;
  description: string;
  confidence: number;
  dimensionKey: string;
  evidenceExcerpt: string;
};

export type AssessmentMetrics = {
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  overallScore: number;
};

export type AssessmentEvaluation = {
  stage: AcademicStageCode;
  title: string;
  narrative: string;
  recommendations: string[];
  metrics: AssessmentMetrics;
  answers: ValidatedAssessmentAnswer[];
  signalUpdates: AssessmentSignalUpdate[];
};

export type AssessmentSnapshot = {
  stage: AcademicStageCode;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  narrative: string;
  takenAt: string | Date;
};

export type ReportPoint = AssessmentSnapshot & {
  stageLabel: string;
};

export type YearlyReport = {
  timeline: ReportPoint[];
  completedStages: number;
  completionRatio: number;
  evolutionSummary: string;
  strongestImprovement: string;
  keyRisk: string;
};

const STAGE_ORDER: AcademicStageCode[] = ["FY", "SY", "TY", "LY"];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeMcqScore(score: number) {
  return (score - 1) / 3;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMcqExcerpt(question: McqQuestion, score: number, optionLabel: string) {
  return `${question.prompt} Answer: ${optionLabel} (${score}/4).`;
}

function validateAnswer(question: AssessmentQuestion, answer?: AssessmentAnswerInput) {
  if (!answer) {
    throw new Error(`Missing answer for question "${question.prompt}"`);
  }

  if (question.type === "MCQ") {
    if (typeof answer.answerScore !== "number" || !Number.isFinite(answer.answerScore)) {
      throw new Error(`Question "${question.prompt}" requires a valid MCQ answer.`);
    }

    const matchedOption = question.options.find((option) => option.value === answer.answerScore);
    if (!matchedOption) {
      throw new Error(`Question "${question.prompt}" has an invalid MCQ option.`);
    }

    return {
      question,
      answerScore: answer.answerScore,
      optionLabel: matchedOption.label,
    } satisfies ValidatedAssessmentAnswer;
  }

  const trimmed = answer.answerText?.trim() ?? "";
  if (trimmed.length < question.minLength) {
    throw new Error(`Question "${question.prompt}" requires at least ${question.minLength} characters.`);
  }

  return {
    question,
    answerText: trimmed,
  } satisfies ValidatedAssessmentAnswer;
}

function createNarrative(
  stage: AcademicStageCode,
  metrics: AssessmentMetrics,
  previous?: AssessmentSnapshot,
) {
  const label = getStageMetadata(stage).label;
  const asset =
    metrics.strengthsScore >= metrics.opportunitiesScore ? "strengths" : "opportunities";
  const risk =
    metrics.weaknessesScore >= metrics.threatsScore ? "weaknesses" : "threats";

  const sentences = [
    `${label} review shows the student's biggest current asset is ${asset} and the main area needing attention is ${risk}.`,
  ];

  if (previous) {
    const overallDelta = metrics.overallScore - previous.overallScore;
    if (overallDelta >= 0.08) {
      sentences.push("Compared with the previous year, the student shows clear overall improvement and better balance across the SWOT profile.");
    } else if (overallDelta <= -0.08) {
      sentences.push("Compared with the previous year, the student is carrying more friction and would benefit from targeted support before the next transition.");
    } else {
      sentences.push("Compared with the previous year, progress is relatively steady, with only modest movement in the overall profile.");
    }
  } else {
    sentences.push("This becomes the structured baseline for future year-over-year comparison instead of relying only on chat data.");
  }

  if (metrics.threatsScore >= 0.66 || metrics.weaknessesScore >= 0.66) {
    sentences.push("Risk signals are high enough that regular review is recommended even if the student does not check in daily.");
  } else if (metrics.strengthsScore >= 0.66 && metrics.opportunitiesScore >= 0.66) {
    sentences.push("The student has enough positive momentum to focus on leveraging opportunities rather than only fixing problems.");
  }

  return sentences.join(" ");
}

function buildRecommendations(metrics: AssessmentMetrics) {
  const recommendations: string[] = [];

  if (metrics.weaknessesScore >= 0.66) {
    recommendations.push("Create one simple accountability routine for self-management and follow-through.");
  }

  if (metrics.threatsScore >= 0.66) {
    recommendations.push("Schedule mentor or teacher reviews to reduce hidden risk before it grows.");
  }

  if (metrics.opportunitiesScore < 0.45) {
    recommendations.push("Actively use clubs, mentors, peers, or alumni as external growth opportunities.");
  }

  if (metrics.strengthsScore < 0.45) {
    recommendations.push("Reinforce one core confidence-building habit so strengths become more visible and repeatable.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Keep reviewing the profile at milestone points so growth is documented even without daily chat activity.");
  }

  return recommendations;
}

export function evaluateAssessment(
  stage: AcademicStageCode,
  rawAnswers: AssessmentAnswerInput[],
  previous?: AssessmentSnapshot,
): AssessmentEvaluation {
  const questionSet = getAssessmentQuestionSet(stage);
  const answerMap = new Map(rawAnswers.map((answer) => [answer.questionKey, answer]));
  const answers = questionSet.questions.map((question) => validateAnswer(question, answerMap.get(question.key)));

  const strengths: number[] = [];
  const weaknesses: number[] = [];
  const opportunities: number[] = [];
  const threats: number[] = [];
  const signalUpdates: AssessmentSignalUpdate[] = [];
  const writtenByDimension = new Map<string, string[]>();

  for (const answer of answers) {
    const question = answer.question;

    if (question.type === "WRITTEN" && answer.answerText) {
      const entries = writtenByDimension.get(question.dimensionKey) ?? [];
      entries.push(answer.answerText);
      writtenByDimension.set(question.dimensionKey, entries);
      continue;
    }

    if (question.type !== "MCQ") {
      continue;
    }

    const score = answer.answerScore as number;
    const normalized = normalizeMcqScore(score);

    if (question.category === "STRENGTH") strengths.push(normalized);
    if (question.category === "WEAKNESS") weaknesses.push(normalized);
    if (question.category === "OPPORTUNITY") opportunities.push(normalized);
    if (question.category === "THREAT") threats.push(normalized);

    const shouldUseHighSignal = normalized >= 0.55;
    const shouldUseLowSignal = normalized <= 0.35 && Boolean(question.lowSignal);
    const chosenSignal = shouldUseHighSignal
      ? question.highSignal
      : shouldUseLowSignal
        ? question.lowSignal ?? null
        : null;

    if (!chosenSignal) {
      continue;
    }

    const confidence = round2(
      shouldUseHighSignal ? 0.52 + normalized * 0.38 : 0.52 + (1 - normalized) * 0.28,
    );

      signalUpdates.push({
      category: chosenSignal.category,
      title: chosenSignal.title,
      description: chosenSignal.description,
      confidence,
      dimensionKey: question.dimensionKey,
      evidenceExcerpt: buildMcqExcerpt(
        question as McqQuestion,
        score,
        answer.optionLabel ?? "Unknown",
      ),
    });
  }

  for (const update of signalUpdates) {
    const writtenEvidence = writtenByDimension.get(update.dimensionKey);
    if (writtenEvidence?.length) {
      update.evidenceExcerpt = `${update.evidenceExcerpt} Reflection: ${writtenEvidence[0]}`;
    }
  }

  const metrics = {
    strengthsScore: round2(average(strengths)),
    weaknessesScore: round2(average(weaknesses)),
    opportunitiesScore: round2(average(opportunities)),
    threatsScore: round2(average(threats)),
    overallScore: 0,
  } satisfies AssessmentMetrics;

  metrics.overallScore = round2(
    average([
      metrics.strengthsScore,
      metrics.opportunitiesScore,
      1 - metrics.weaknessesScore,
      1 - metrics.threatsScore,
    ]),
  );

  return {
    stage,
    title: questionSet.title,
    narrative: createNarrative(stage, metrics, previous),
    recommendations: buildRecommendations(metrics),
    metrics,
    answers,
    signalUpdates,
  };
}

export function buildYearlyReport(snapshots: AssessmentSnapshot[]): YearlyReport {
  const timeline = [...snapshots]
    .sort((left, right) => STAGE_ORDER.indexOf(left.stage) - STAGE_ORDER.indexOf(right.stage))
    .map((snapshot) => ({
      ...snapshot,
      stageLabel: getStageMetadata(snapshot.stage).label,
    }));

  if (timeline.length === 0) {
    return {
      timeline,
      completedStages: 0,
      completionRatio: 0,
      evolutionSummary: "No yearly assessment has been completed yet.",
      strongestImprovement: "No improvement trend available yet.",
      keyRisk: "No risk trend available yet.",
    };
  }

  const first = timeline[0];
  const latest = timeline[timeline.length - 1];
  const improvements = [
    {
      label: "strengths confidence",
      delta: latest.strengthsScore - first.strengthsScore,
    },
    {
      label: "opportunity usage",
      delta: latest.opportunitiesScore - first.opportunitiesScore,
    },
    {
      label: "weakness reduction",
      delta: first.weaknessesScore - latest.weaknessesScore,
    },
    {
      label: "threat reduction",
      delta: first.threatsScore - latest.threatsScore,
    },
  ].sort((left, right) => right.delta - left.delta);

  const keyRisk =
    latest.threatsScore >= latest.weaknessesScore
      ? "Threat pressure is the clearest risk in the latest year."
      : "Weakness patterns need the most attention in the latest year.";

  const evolutionSummary =
    timeline.length === 1
      ? `${latest.stageLabel} is now the baseline year for structured SWOT tracking.`
      : `From ${first.stageLabel} to ${latest.stageLabel}, the overall profile moved from ${Math.round(first.overallScore * 100)}% to ${Math.round(latest.overallScore * 100)}%, showing how the student evolved across academic years.`;

  return {
    timeline,
    completedStages: timeline.length,
    completionRatio: round2(timeline.length / STAGE_ORDER.length),
    evolutionSummary,
    strongestImprovement: `The strongest positive shift is in ${improvements[0]?.label ?? "overall balance"}.`,
    keyRisk,
  };
}

export function getPreviousStage(stage: AcademicStageCode) {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) {
    return null;
  }

  return STAGE_ORDER[index - 1];
}
