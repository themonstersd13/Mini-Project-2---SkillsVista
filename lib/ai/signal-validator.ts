import { prisma } from "@/lib/db";
import type { SWOTCategory, EvidenceType } from "@prisma/client";

export type CandidateSignal = {
  title: string;
  category: SWOTCategory;
  confidence: number;
  reason: string;
  evidenceType: EvidenceType;
  evidenceExcerpt: string;
};

export type ValidationResult = {
  isRecurring: boolean;
  isMeaningful: boolean;
  isEvidenceBacked: boolean;
  isConsistentWithHistory: boolean;
  validationScore: number;
  shouldAsk: boolean;
  followUpQuestion?: string;
};

/**
 * Validate a candidate signal against history and rules.
 * Returns whether the signal should be applied, rejected, or followed up on.
 */
export async function validateSignal(
  userId: string,
  candidate: CandidateSignal,
): Promise<ValidationResult> {
  // Check recurrence: has a similar signal appeared before?
  const existingSignals = await prisma.signal.findMany({
    where: {
      userId,
      title: candidate.title,
      category: candidate.category,
    },
    select: {
      id: true,
      recurrenceCount: true,
      createdAt: true,
    },
  });

  const isRecurring = existingSignals.length > 0;
  const totalRecurrence = existingSignals.reduce(
    (sum, s) => sum + s.recurrenceCount,
    0,
  );

  // Check evidence quality
  const isEvidenceBacked =
    candidate.evidenceExcerpt.length > 20 &&
    candidate.confidence >= 0.4;

  // Check meaningfulness — is this about long-term growth or just today's mood?
  const moodOnlyPatterns = /(feeling|mood|today|right now|at the moment)/i;
  const isMeaningful = !moodOnlyPatterns.test(candidate.reason);

  // Check consistency with existing SWOT items
  const existingSwotItem = await prisma.swotItem.findFirst({
    where: {
      userId,
      title: candidate.title,
      category: candidate.category,
    },
  });

  // If the signal contradicts an existing item in the opposite category, flag it
  const oppositeCategory =
    candidate.category === "STRENGTH"
      ? "WEAKNESS"
      : candidate.category === "WEAKNESS"
        ? "STRENGTH"
        : null;

  let isConsistentWithHistory = true;
  if (oppositeCategory) {
    const contradicting = await prisma.swotItem.findFirst({
      where: {
        userId,
        title: { contains: candidate.title.split(" ")[0] },
        category: oppositeCategory,
        status: "ACTIVE",
      },
    });
    if (contradicting) {
      isConsistentWithHistory = false;
    }
  }

  // Composite validation score
  let validationScore = candidate.confidence;

  if (isRecurring) validationScore += 0.1;
  if (totalRecurrence >= 3) validationScore += 0.1;
  if (isMeaningful) validationScore += 0.05;
  if (isEvidenceBacked) validationScore += 0.05;
  if (!isConsistentWithHistory) validationScore -= 0.15;

  validationScore = Math.max(0, Math.min(1, validationScore));

  // Decision logic
  const shouldAsk = validationScore >= 0.5 && validationScore < 0.72;
  let followUpQuestion: string | undefined;

  if (shouldAsk) {
    followUpQuestion = generateFollowUpQuestion(candidate);
  }

  return {
    isRecurring,
    isMeaningful,
    isEvidenceBacked,
    isConsistentWithHistory,
    validationScore,
    shouldAsk,
    followUpQuestion,
  };
}

function generateFollowUpQuestion(candidate: CandidateSignal): string {
  const questions: Record<string, string> = {
    STRENGTH: `I noticed a potential strength in "${candidate.title}". Has this been a consistent pattern for you, or more of a recent change?`,
    WEAKNESS: `I'm picking up a possible challenge around "${candidate.title}". Is this something you've struggled with over time, or is it more situational?`,
    OPPORTUNITY: `There might be an opportunity related to "${candidate.title}". Are you actively exploring this, or is it still on your radar?`,
    THREAT: `I want to flag a potential concern about "${candidate.title}". How worried are you about this affecting your progress?`,
  };

  return (
    questions[candidate.category] ??
    `Can you tell me more about "${candidate.title}"?`
  );
}

/**
 * Record a signal in the database after extraction.
 */
export async function recordSignal(
  userId: string,
  candidate: CandidateSignal,
  status: "PENDING" | "VALIDATED" | "REJECTED",
  swotItemId?: string,
): Promise<string> {
  // Check for existing signal to update recurrence
  const existing = await prisma.signal.findFirst({
    where: {
      userId,
      title: candidate.title,
      category: candidate.category,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const updated = await prisma.signal.update({
      where: { id: existing.id },
      data: {
        recurrenceCount: existing.recurrenceCount + 1,
        confidence: Math.min(0.98, candidate.confidence),
        reason: candidate.reason,
        evidenceExcerpt: candidate.evidenceExcerpt,
        status,
        validatedAt: status === "VALIDATED" ? new Date() : undefined,
        rejectedAt: status === "REJECTED" ? new Date() : undefined,
      },
    });
    return updated.id;
  }

  const created = await prisma.signal.create({
    data: {
      userId,
      swotItemId: swotItemId ?? null,
      title: candidate.title,
      category: candidate.category,
      confidence: candidate.confidence,
      status,
      reason: candidate.reason,
      evidenceExcerpt: candidate.evidenceExcerpt,
      evidenceType: candidate.evidenceType,
      validatedAt: status === "VALIDATED" ? new Date() : undefined,
    },
  });
  return created.id;
}
