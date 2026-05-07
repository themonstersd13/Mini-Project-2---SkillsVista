import {
  AssessmentQuestionType,
  EvidenceType,
  SWOTStatus,
  type AcademicStage,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getAssessmentQuestionBank,
  academicStages,
  type AcademicStageCode,
} from "@/lib/assessment/question-bank";
import {
  buildYearlyReport,
  evaluateAssessment,
  getPreviousStage,
  type AssessmentAnswerInput,
  type AssessmentSnapshot,
} from "@/lib/assessment/reporting";
import { invalidateUserCaches } from "@/lib/memory/memory-manager";
import { writeAuditLog } from "@/lib/server/audit";

function toAcademicStage(stage: AcademicStageCode) {
  return stage as AcademicStage;
}

async function upsertAssessmentSignal(
  userId: string,
  stage: AcademicStageCode,
  signal: ReturnType<typeof evaluateAssessment>["signalUpdates"][number],
) {
  const existing = await prisma.swotItem.findFirst({
    where: {
      userId,
      title: signal.title,
      category: signal.category,
    },
  });

  const source = `assessment:${stage}`;
  const now = new Date();

  if (!existing) {
    const created = await prisma.swotItem.create({
      data: {
        userId,
        category: signal.category,
        title: signal.title,
        description: signal.description,
        confidence: signal.confidence,
        status: SWOTStatus.ACTIVE,
        signalCount: 1,
        lastUpdatedAt: now,
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
        reason: `Created from ${stage} structured assessment`,
        confidenceFrom: 0,
        confidenceTo: created.confidence,
        statusFrom: SWOTStatus.UNCERTAIN,
        statusTo: SWOTStatus.ACTIVE,
        snapshot: {
          title: created.title,
          description: created.description,
          stage,
        },
      },
    });

    return {
      title: created.title,
      status: "CREATED",
      reason: `Updated from ${stage} structured assessment`,
    };
  }

  const nextConfidence = Math.min(
    0.99,
    existing.confidence * 0.62 + signal.confidence * 0.38 + 0.04,
  );

  const updated = await prisma.swotItem.update({
    where: { id: existing.id },
    data: {
      description: signal.description,
      confidence: nextConfidence,
      status: SWOTStatus.ACTIVE,
      signalCount: existing.signalCount + 1,
      lastUpdatedAt: now,
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
      reason: `Refreshed from ${stage} structured assessment`,
      confidenceFrom: existing.confidence,
      confidenceTo: updated.confidence,
      statusFrom: existing.status,
      statusTo: updated.status,
      snapshot: {
        title: updated.title,
        description: updated.description,
        stage,
      },
    },
  });

  return {
    title: updated.title,
    status: "UPDATED",
    reason: `Reinforced from ${stage} structured assessment`,
  };
}

function serializeSnapshot(entry: {
  academicStage: AcademicStage;
  overallScore: number;
  strengthsScore: number;
  weaknessesScore: number;
  opportunitiesScore: number;
  threatsScore: number;
  narrative: string;
  takenAt: Date;
}): AssessmentSnapshot {
  return {
    stage: entry.academicStage as AcademicStageCode,
    overallScore: entry.overallScore,
    strengthsScore: entry.strengthsScore,
    weaknessesScore: entry.weaknessesScore,
    opportunitiesScore: entry.opportunitiesScore,
    threatsScore: entry.threatsScore,
    narrative: entry.narrative,
    takenAt: entry.takenAt,
  };
}

function getNextStage(completedStages: string[]) {
  return academicStages.find((stage) => !completedStages.includes(stage)) ?? null;
}

export async function getAssessmentDashboardData(userId: string) {
  const assessments = await prisma.swotAssessment.findMany({
    where: { userId },
    orderBy: { takenAt: "asc" },
    include: {
      answers: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const snapshots = assessments.map((assessment) => serializeSnapshot(assessment));

  return {
    questionBank: getAssessmentQuestionBank(),
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      academicStage: assessment.academicStage,
      title: assessment.title,
      overallScore: assessment.overallScore,
      strengthsScore: assessment.strengthsScore,
      weaknessesScore: assessment.weaknessesScore,
      opportunitiesScore: assessment.opportunitiesScore,
      threatsScore: assessment.threatsScore,
      narrative: assessment.narrative,
      recommendations: assessment.recommendations,
      takenAt: assessment.takenAt,
      answers: assessment.answers.map((answer) => ({
        questionKey: answer.questionKey,
        answerScore: answer.answerScore,
        answerText: answer.answerText,
      })),
    })),
    report: buildYearlyReport(snapshots),
    nextStage: getNextStage(assessments.map((assessment) => assessment.academicStage)),
  };
}

export async function submitAssessment(
  userId: string,
  academicStage: AcademicStageCode,
  answers: AssessmentAnswerInput[],
) {
  const previousStage = getPreviousStage(academicStage);
  const previousAssessment = previousStage
    ? await prisma.swotAssessment.findUnique({
        where: {
          userId_academicStage: {
            userId,
            academicStage: toAcademicStage(previousStage),
          },
        },
      })
    : null;

  const evaluation = evaluateAssessment(
    academicStage,
    answers,
    previousAssessment ? serializeSnapshot(previousAssessment) : undefined,
  );

  const savedAssessment = await prisma.swotAssessment.upsert({
    where: {
      userId_academicStage: {
        userId,
        academicStage: toAcademicStage(academicStage),
      },
    },
    create: {
      userId,
      academicStage: toAcademicStage(academicStage),
      title: evaluation.title,
      overallScore: evaluation.metrics.overallScore,
      strengthsScore: evaluation.metrics.strengthsScore,
      weaknessesScore: evaluation.metrics.weaknessesScore,
      opportunitiesScore: evaluation.metrics.opportunitiesScore,
      threatsScore: evaluation.metrics.threatsScore,
      narrative: evaluation.narrative,
      recommendations: evaluation.recommendations,
      takenAt: new Date(),
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
          answerText: answer.answerText,
          answerScore: answer.answerScore,
          optionLabel: answer.optionLabel,
          weight: answer.question.weight,
          evidenceExcerpt:
            answer.question.type === "WRITTEN"
              ? answer.answerText
              : `${answer.question.prompt} Answer: ${answer.optionLabel} (${answer.answerScore}/4).`,
        })),
      },
    },
    update: {
      title: evaluation.title,
      overallScore: evaluation.metrics.overallScore,
      strengthsScore: evaluation.metrics.strengthsScore,
      weaknessesScore: evaluation.metrics.weaknessesScore,
      opportunitiesScore: evaluation.metrics.opportunitiesScore,
      threatsScore: evaluation.metrics.threatsScore,
      narrative: evaluation.narrative,
      recommendations: evaluation.recommendations,
      takenAt: new Date(),
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
          answerText: answer.answerText,
          answerScore: answer.answerScore,
          optionLabel: answer.optionLabel,
          weight: answer.question.weight,
          evidenceExcerpt:
            answer.question.type === "WRITTEN"
              ? answer.answerText
              : `${answer.question.prompt} Answer: ${answer.optionLabel} (${answer.answerScore}/4).`,
        })),
      },
    },
    include: {
      answers: true,
    },
  });

  const updates = [];
  for (const signal of evaluation.signalUpdates) {
    const update = await upsertAssessmentSignal(userId, academicStage, signal);
    updates.push(update);
  }

  await writeAuditLog({
    userId,
    action: "ASSESSMENT_SUBMITTED",
    entityType: "SwotAssessment",
    entityId: savedAssessment.id,
    actor: "user",
    details: {
      academicStage,
      overallScore: evaluation.metrics.overallScore,
      generatedSignals: evaluation.signalUpdates.length,
    },
  });

  invalidateUserCaches(userId);

  return {
    assessment: {
      id: savedAssessment.id,
      academicStage: savedAssessment.academicStage,
      title: savedAssessment.title,
      overallScore: savedAssessment.overallScore,
      strengthsScore: savedAssessment.strengthsScore,
      weaknessesScore: savedAssessment.weaknessesScore,
      opportunitiesScore: savedAssessment.opportunitiesScore,
      threatsScore: savedAssessment.threatsScore,
      narrative: savedAssessment.narrative,
      recommendations: savedAssessment.recommendations,
      takenAt: savedAssessment.takenAt,
    },
    updates,
    report: await getAssessmentDashboardData(userId),
  };
}
