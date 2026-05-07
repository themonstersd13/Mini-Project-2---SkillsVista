import { prisma } from "@/lib/db";

const SESSION_GAP_HOURS = 4;

/**
 * Get or create the current session for a user.
 * A new session is created if the last message was more than 4 hours ago.
 */
export async function getOrCreateSession(userId: string): Promise<{
  id: string;
  isNew: boolean;
}> {
  const latestSession = await prisma.session.findFirst({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      lastMessageAt: true,
    },
  });

  if (latestSession) {
    const hoursSinceLastMessage =
      (Date.now() - latestSession.lastMessageAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage < SESSION_GAP_HOURS) {
      return { id: latestSession.id, isNew: false };
    }
  }

  // Create a new session
  const newSession = await prisma.session.create({
    data: { userId },
  });

  return { id: newSession.id, isNew: true };
}

/**
 * Update session's lastMessageAt and increment messageCount.
 */
export async function touchSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });
}

/**
 * Store a summary for a session (called on session close or periodically).
 */
export async function updateSessionSummary(
  sessionId: string,
  summary: string,
): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { summary },
  });
}

/**
 * Get past sessions for the user (read-only display).
 */
export async function getSessionHistory(
  userId: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    startedAt: Date;
    lastMessageAt: Date;
    summary: string | null;
    messageCount: number;
  }>
> {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    select: {
      id: true,
      startedAt: true,
      lastMessageAt: true,
      summary: true,
      messageCount: true,
    },
  });
}

/**
 * Get messages from a specific past session (read-only).
 */
export async function getSessionMessages(
  userId: string,
  sessionId: string,
): Promise<
  Array<{
    id: string;
    role: string;
    content: string;
    moodScore: number | null;
    createdAt: Date;
  }>
> {
  return prisma.chatMessage.findMany({
    where: { userId, sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      moodScore: true,
      createdAt: true,
    },
  });
}

/**
 * Update user streak based on activity.
 */
export async function updateUserStreak(userId: string): Promise<void> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      lastActiveAt: true,
      currentStreak: true,
      longestStreak: true,
    },
  });

  if (!profile) {
    return;
  }

  const now = new Date();
  const lastActive = profile.lastActiveAt;
  const daysSinceLastActive = Math.floor(
    (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
  );

  let newStreak = profile.currentStreak;

  if (daysSinceLastActive <= 1) {
    // Same day or next day — continue streak
    if (daysSinceLastActive === 1) {
      newStreak += 1;
    }
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(profile.longestStreak, newStreak);

  await prisma.userProfile.update({
    where: { userId },
    data: {
      lastActiveAt: now,
      currentStreak: newStreak,
      longestStreak: newLongest,
    },
  });
}
