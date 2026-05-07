import { prisma } from "@/lib/db";

/**
 * Generate proactive hints for the context builder.
 * Pure DB queries — no LLM calls. Runs in parallel with memory layers.
 */
export async function getProactiveHints(userId: string): Promise<string[]> {
  const hints: string[] = [];
  const now = new Date();

  const [profile, overdueTasks, recentSignals, activeGoals, lastMessage] =
    await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          lastActiveAt: true,
          currentStreak: true,
          longestStreak: true,
        },
      }),

      // Overdue tasks
      prisma.task.findMany({
        where: {
          userId,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
        select: { title: true, dueDate: true },
        take: 3,
      }),

      // Recent recurring signals
      prisma.signal.findMany({
        where: {
          userId,
          recurrenceCount: { gte: 3 },
          status: { in: ["PENDING", "VALIDATED"] },
        },
        select: {
          title: true,
          category: true,
          recurrenceCount: true,
        },
        take: 3,
      }),

      // Goals with no progress change in 7+ days
      prisma.goal.findMany({
        where: {
          userId,
          status: "ACTIVE",
          updatedAt: {
            lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { title: true, updatedAt: true },
        take: 3,
      }),

      // Last user message
      prisma.chatMessage.findFirst({
        where: { userId, role: "USER" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  // Inactivity detection (2+ days since last message)
  if (lastMessage) {
    const daysSince = Math.floor(
      (now.getTime() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSince >= 2) {
      hints.push(
        `User hasn't checked in for ${daysSince} days. Welcome them back warmly and ask about their progress.`,
      );
    }
  }

  // Streak reinforcement
  if (profile) {
    if (profile.currentStreak >= 3) {
      hints.push(
        `User is on a ${profile.currentStreak}-day streak! Acknowledge this positive momentum.`,
      );
    }
    if (
      profile.currentStreak > 0 &&
      profile.currentStreak >= profile.longestStreak
    ) {
      hints.push(
        `This is the user's LONGEST streak ever (${profile.currentStreak} days). Celebrate this milestone!`,
      );
    }
  }

  // Missed/overdue tasks
  for (const task of overdueTasks) {
    const daysOverdue = task.dueDate
      ? Math.floor(
          (now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;
    hints.push(
      `Task "${task.title}" is ${daysOverdue} day(s) overdue. Gently check if they need help or want to reschedule.`,
    );
  }

  // Recurring weakness/threat signals
  for (const signal of recentSignals) {
    if (signal.category === "WEAKNESS" || signal.category === "THREAT") {
      hints.push(
        `Recurring ${signal.category.toLowerCase()} pattern detected: "${signal.title}" (${signal.recurrenceCount}x). Consider suggesting a systemic solution.`,
      );
    }
  }

  // Stalled goals
  for (const goal of activeGoals) {
    hints.push(
      `Goal "${goal.title}" hasn't seen progress in 7+ days. Ask what's blocking it.`,
    );
  }

  // Threat early warning: check for rising-confidence threats
  const risingThreats = await prisma.swotItem.findMany({
    where: {
      userId,
      category: "THREAT",
      status: "ACTIVE",
      confidence: { gte: 0.7 },
    },
    select: { title: true, confidence: true },
    take: 2,
  });

  for (const threat of risingThreats) {
    hints.push(
      `Threat "${threat.title}" has high confidence (${(threat.confidence * 100).toFixed(0)}%). Warn the user and suggest mitigation.`,
    );
  }

  return hints.slice(0, 5); // Cap at 5 hints to avoid context overload
}
