import {
  AssessmentQuestionType,
  EvidenceType,
  SWOTStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildWeeklyQuestionnaire,
  evaluateWeeklyAssessment,
  getWeeklyAssessmentWindow,
  weeklyScoreOptions,
  type WeeklyAssessmentSnapshot,
} from "@/lib/assessment/weekly";
import { invalidateUserCaches } from "@/lib/memory/memory-manager";
import { writeAuditLog } from "@/lib/server/audit";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function upsertGenericWeeklySignal(
  userId: string,
  source: string,
  signal: {
    category: "STRENGTH" | "WEAKNESS" | "OPPORTUNITY" | "THREAT";
    title: string;
    description: string;
    confidence: number;
    evidenceExcerpt: string;
  },
) {
  const existing = await prisma.swotItem.findFirst({
    where: {
      userId,
      title: signal.title,
      category: signal.category,
    },
  });

  if (!existing) {
    const created = await prisma.swotItem.create({
      data: {
        userId,
        category: signal.category,
        title: signal.title,
        description: signal.description,
        confidence: signal.confidence,
        status: signal.confidence >= 0.68 ? SWOTStatus.ACTIVE : SWOTStatus.UNCERTAIN,
        signalCount: 1,
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.evidence.create({
      data: {
        userId,
        swotItemId: created.id,
        type: EvidenceType.ASSESSMENT,
        source,
        excerpt: signal.evidenceExcerpt,
        score: signal.confidence,
      },
    });

    await prisma.swotItemVersion.create({
      data: {
        swotItemId: created.id,
        changedBy: "assessment",
        reason: "Created from weekly assessment",
        confidenceFrom: 0,
        confidenceTo: created.confidence,
        statusFrom: SWOTStatus.UNCERTAIN,
        statusTo: created.status,
        snapshot: {
          title: created.title,
          description: created.description,
        },
      },
    });

    return {
      title: created.title,
      status: "CREATED",
      reason: "New weekly assessment signal added to SWOT",
    };
  }

  const nextConfidence = clamp(
    existing.confidence * 0.64 + signal.confidence * 0.36 + 0.03,
    0.2,
    0.98,
  );
  const nextStatus =
    nextConfidence >= 0.68 ? SWOTStatus.ACTIVE : SWOTStatus.UNCERTAIN;

  const updated = await prisma.swotItem.update({
    where: { id: existing.id },
    data: {
      description: signal.description,
      confidence: nextConfidence,
      status: nextStatus,
      signalCount: existing.signalCount + 1,
      lastUpdatedAt: new Date(),
    },
  });

  await prisma.evidence.create({
    data: {
      userId,
      swotItemId: updated.id,
      type: EvidenceType.ASSESSMENT,
      source,
      excerpt: signal.evidenceExcerpt,
      score: signal.confidence,
    },
  });

  await prisma.swotItemVersion.create({
    data: {
      swotItemId: updated.id,
      changedBy: "assessment",
      reason: "Reinforced from weekly assessment",
      confidenceFrom: existing.confidence,
      confidenceTo: updated.confidence,
      statusFrom: existing.status,
      statusTo: updated.status,
      snapshot: {
        title: updated.title,
        description: updated.description,
      },
    },
  });

  return {
    title: updated.title,
    status: "UPDATED",
    reason: "Weekly assessment reinforced an existing SWOT pattern",
  };
}

async function applyLinkedWeeklyUpdate(
  userId: string,
  source: string,
  update: {
    swotItemId: string;
    swotTitle: string;
    category: "STRENGTH" | "WEAKNESS" | "OPPORTUNITY" | "THREAT";
    confidenceDelta: number;
    evidenceExcerpt: string;
  },
) {
  const item = await prisma.swotItem.findFirst({
    where: {
      id: update.swotItemId,
      userId,
    },
  });

  if (!item) {
    return null;
  }

  const nextConfidence = clamp(item.confidence + update.confidenceDelta, 0.15, 0.99);
  const nextStatus =
    nextConfidence >= 0.68 ? SWOTStatus.ACTIVE : SWOTStatus.UNCERTAIN;

  const updated = await prisma.swotItem.update({
    where: { id: item.id },
    data: {
      confidence: nextConfidence,
      status: nextStatus,
      signalCount: item.signalCount + 1,
      lastUpdatedAt: new Date(),
    },
  });

  await prisma.evidence.create({
    data: {
      userId,
      swotItemId: updated.id,
      type: EvidenceType.ASSESSMENT,
      source,
      excerpt: update.evidenceExcerpt,
      score: nextConfidence,
    },
  });

  await prisma.swotItemVersion.create({
    data: {
      swotItemId: updated.id,
      changedBy: "assessment",
      reason: "Weekly personalized SWOT check-in",
      confidenceFrom: item.confidence,
      confidenceTo: updated.confidence,
      statusFrom: item.status,
      statusTo: updated.status,
      snapshot: {
        title: updated.title,
        linkedQuestion: update.swotTitle,
      },
    },
  });

  return {
    title: updated.title,
    status: update.confidenceDelta >= 0 ? "UPDATED" : "REVIEWED",
    reason:
      update.confidenceDelta >= 0
        ? "Weekly SWOT-based question reinforced this item"
        : "Weekly SWOT-based question reduced the confidence of this item",
  };
}

function toPreviousSnapshot(entry: {
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  weekStart: Date;
  weekEnd: Date;
}): WeeklyAssessmentSnapshot {
  return {
    overallScore: entry.overallScore,
    strengthsScore: entry.strengthsScore,
    weaknessesScore: entry.weaknessesScore,
    opportunitiesScore: entry.opportunitiesScore,
    threatsScore: entry.threatsScore,
    weekLabel: `${entry.weekStart.toISOString().slice(0, 10)} to ${entry.weekEnd.toISOString().slice(0, 10)}`,
  };
}

export async function getWeeklyAssessmentData(userId: string) {
  const window = getWeeklyAssessmentWindow();

  const [swotItems, currentWeekAssessment, history] = await Promise.all([
    prisma.swotItem.findMany({
      where: {
        userId,
        status: {
          not: SWOTStatus.RETIRED,
        },
      },
      orderBy: [{ confidence: "desc" }, { lastUpdatedAt: "desc" }],
      take: 12,
    }),
    prisma.weeklyAssessment.findUnique({
      where: {
        userId_weekStart: {
          userId,
          weekStart: window.start,
        },
      },
      include: {
        answers: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.weeklyAssessment.findMany({
      where: { userId },
      orderBy: { weekStart: "desc" },
      take: 8,
    }),
  ]);

  const questionnaire = buildWeeklyQuestionnaire(
    swotItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      confidence: item.confidence,
      status: item.status,
    })),
    window.start,
  );

  return {
    questionnaire,
    completion: {
      completedThisWeek: Boolean(currentWeekAssessment),
      weekStart: window.start,
      weekEnd: window.end,
      submittedAt: currentWeekAssessment?.updatedAt ?? null,
    },
    existingAnswers:
      currentWeekAssessment?.answers.map((answer) => ({
        questionKey: answer.questionKey,
        answerScore: answer.answerScore,
        answerText: answer.answerText,
      })) ?? [],
    history: history
      .slice()
      .reverse()
      .map((entry) => ({
        id: entry.id,
        weekStart: entry.weekStart,
        weekEnd: entry.weekEnd,
        overallScore: entry.overallScore,
        strengthsScore: entry.strengthsScore,
        weaknessesScore: entry.weaknessesScore,
        opportunitiesScore: entry.opportunitiesScore,
        threatsScore: entry.threatsScore,
        summary: entry.summary,
      })),
  };
}

export async function submitWeeklyAssessment(
  userId: string,
  answers: Array<{ questionKey: string; answerScore?: number; answerText?: string }>,
) {
  const window = getWeeklyAssessmentWindow();
  const swotItems = await prisma.swotItem.findMany({
    where: {
      userId,
      status: {
        not: SWOTStatus.RETIRED,
      },
    },
    orderBy: [{ confidence: "desc" }, { lastUpdatedAt: "desc" }],
    take: 12,
  });

  const questionnaire = buildWeeklyQuestionnaire(
    swotItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      confidence: item.confidence,
      status: item.status,
    })),
    window.start,
  );

  const previousAssessment = await prisma.weeklyAssessment.findFirst({
    where: {
      userId,
      weekStart: {
        lt: window.start,
      },
    },
    orderBy: { weekStart: "desc" },
  });

  const evaluation = evaluateWeeklyAssessment(
    questionnaire,
    answers,
    previousAssessment ? toPreviousSnapshot(previousAssessment) : undefined,
  );

  const saved = await prisma.weeklyAssessment.upsert({
    where: {
      userId_weekStart: {
        userId,
        weekStart: window.start,
      },
    },
    create: {
      userId,
      weekStart: window.start,
      weekEnd: window.end,
      overallScore: evaluation.metrics.overallScore,
      strengthsScore: evaluation.metrics.strengthsScore,
      weaknessesScore: evaluation.metrics.weaknessesScore,
      opportunitiesScore: evaluation.metrics.opportunitiesScore,
      threatsScore: evaluation.metrics.threatsScore,
      summary: evaluation.summary,
      recommendations: evaluation.recommendations,
      answers: {
        create: evaluation.answers.map((answer) => ({
          questionKey: answer.question.key,
          questionType:
            answer.question.type === "MCQ"
              ? AssessmentQuestionType.MCQ
              : AssessmentQuestionType.WRITTEN,
          prompt: answer.question.prompt,
          category: answer.question.category,
          dimensionKey: answer.question.dimensionKey,
          sourceTag: answer.question.sourceTag,
          linkedSwotItemId: answer.question.linkedSwotItemId,
          linkedSwotTitle: answer.question.linkedSwotTitle,
          answerText: answer.answerText,
          answerScore: answer.answerScore,
          optionLabel: answer.optionLabel,
          weight: answer.question.weight,
          evidenceExcerpt:
            answer.answerText ??
            `${answer.question.prompt} Answer: ${answer.optionLabel} (${answer.answerScore}/4).`,
        })),
      },
    },
    update: {
      weekEnd: window.end,
      overallScore: evaluation.metrics.overallScore,
      strengthsScore: evaluation.metrics.strengthsScore,
      weaknessesScore: evaluation.metrics.weaknessesScore,
      opportunitiesScore: evaluation.metrics.opportunitiesScore,
      threatsScore: evaluation.metrics.threatsScore,
      summary: evaluation.summary,
      recommendations: evaluation.recommendations,
      answers: {
        deleteMany: {},
        create: evaluation.answers.map((answer) => ({
          questionKey: answer.question.key,
          questionType:
            answer.question.type === "MCQ"
              ? AssessmentQuestionType.MCQ
              : AssessmentQuestionType.WRITTEN,
          prompt: answer.question.prompt,
          category: answer.question.category,
          dimensionKey: answer.question.dimensionKey,
          sourceTag: answer.question.sourceTag,
          linkedSwotItemId: answer.question.linkedSwotItemId,
          linkedSwotTitle: answer.question.linkedSwotTitle,
          answerText: answer.answerText,
          answerScore: answer.answerScore,
          optionLabel: answer.optionLabel,
          weight: answer.question.weight,
          evidenceExcerpt:
            answer.answerText ??
            `${answer.question.prompt} Answer: ${answer.optionLabel} (${answer.answerScore}/4).`,
        })),
      },
    },
    include: {
      answers: true,
    },
  });

  const source = `weekly:${window.start.toISOString().slice(0, 10)}`;
  const updates = [];

  for (const signal of evaluation.genericSignals) {
    const update = await upsertGenericWeeklySignal(userId, source, signal);
    updates.push(update);
  }

  for (const linked of evaluation.linkedSwotUpdates) {
    const update = await applyLinkedWeeklyUpdate(userId, source, linked);
    if (update) {
      updates.push(update);
    }
  }

  await writeAuditLog({
    userId,
    action: "WEEKLY_ASSESSMENT_SUBMITTED",
    entityType: "WeeklyAssessment",
    entityId: saved.id,
    actor: "user",
    details: {
      weekStart: window.start.toISOString(),
      overallScore: evaluation.metrics.overallScore,
      personalizedQuestions: questionnaire.swotQuestions.length,
      generatedUpdates: updates.length,
    },
  });

  invalidateUserCaches(userId);

  return {
    assessment: {
      id: saved.id,
      weekStart: saved.weekStart,
      weekEnd: saved.weekEnd,
      overallScore: saved.overallScore,
      strengthsScore: saved.strengthsScore,
      weaknessesScore: saved.weaknessesScore,
      opportunitiesScore: saved.opportunitiesScore,
      threatsScore: saved.threatsScore,
      summary: saved.summary,
      recommendations: saved.recommendations,
    },
    updates,
    refreshed: await getWeeklyAssessmentData(userId),
  };
}

export function getWeeklyQuestionOptions() {
  return weeklyScoreOptions;
}
