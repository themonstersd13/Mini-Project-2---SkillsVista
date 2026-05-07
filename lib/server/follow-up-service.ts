import { prisma } from "@/lib/db";

const FOLLOW_UP_EXPIRY_DAYS = 7;

/**
 * Create follow-up records when the coach asks tracked questions.
 */
export async function createFollowUps(
  userId: string,
  questions: string[],
  context?: string,
): Promise<void> {
  if (questions.length === 0) {
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + FOLLOW_UP_EXPIRY_DAYS);

  await prisma.followUp.createMany({
    data: questions.map((question) => ({
      userId,
      question,
      context: context ?? null,
      status: "ASKED" as const,
      askedAt: new Date(),
      expiresAt,
    })),
  });
}

/**
 * Get all pending/asked follow-ups for a user.
 */
export async function getPendingFollowUps(
  userId: string,
): Promise<
  Array<{
    id: string;
    question: string;
    context: string | null;
    status: string;
    createdAt: Date;
  }>
> {
  return prisma.followUp.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "ASKED"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      question: true,
      context: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Mark a follow-up as answered.
 */
export async function markFollowUpAnswered(
  followUpId: string,
  answer?: string,
): Promise<void> {
  await prisma.followUp.update({
    where: { id: followUpId },
    data: {
      status: "ANSWERED",
      answer: answer ?? null,
      answeredAt: new Date(),
    },
  });
}

/**
 * Attempt to match a user message to pending follow-ups.
 * Uses simple keyword matching to detect if the user is responding to a follow-up.
 */
export async function matchFollowUps(
  userId: string,
  message: string,
): Promise<string[]> {
  const pending = await getPendingFollowUps(userId);
  const matched: string[] = [];

  for (const followUp of pending) {
    // Extract key words from the follow-up question
    const keywords = followUp.question
      .toLowerCase()
      .replace(/[?.,!]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const messageLower = message.toLowerCase();
    const matchCount = keywords.filter((k) => messageLower.includes(k)).length;

    // If more than 30% of keywords match, consider it addressed
    if (keywords.length > 0 && matchCount / keywords.length > 0.3) {
      await markFollowUpAnswered(followUp.id, message.slice(0, 500));
      matched.push(followUp.id);
    }
  }

  return matched;
}

/**
 * Expire old follow-ups.
 */
export async function expireOldFollowUps(): Promise<number> {
  const result = await prisma.followUp.updateMany({
    where: {
      status: { in: ["PENDING", "ASKED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  return result.count;
}
