import { prisma } from "@/lib/db";
import { profileCache, swotCache } from "./cache";

export type SwotItemSummary = {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  status: string;
  signalCount: number;
  lastUpdatedAt: Date;
};

export type GoalWithProgress = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  dueDate: Date | null;
  tasksDone: number;
  tasksTotal: number;
};

export type TaskSummary = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  goalTitle: string | null;
};

export type FollowUpItem = {
  id: string;
  question: string;
  context: string | null;
  status: string;
  createdAt: Date;
};

export type SignalSummary = {
  id: string;
  title: string;
  category: string;
  confidence: number;
  status: string;
  reason: string;
  recurrenceCount: number;
  createdAt: Date;
};

export type ProfileSnapshot = {
  academicBackground: string | null;
  goalsSummary: string | null;
  interests: string[];
  habits: string[];
  challenges: string[];
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
};

export type StructuredContext = {
  swotItems: SwotItemSummary[];
  goals: GoalWithProgress[];
  tasks: TaskSummary[];
  followUps: FollowUpItem[];
  signals: SignalSummary[];
  profile: ProfileSnapshot;
  streakInfo: StreakData;
};

/**
 * Fetches all structured memory in parallel for maximum speed.
 */
export async function getStructuredMemory(userId: string): Promise<StructuredContext> {
  // Check caches first
  const cachedProfile = profileCache.get(`profile:${userId}`) as ProfileSnapshot | null;
  const cachedSwot = swotCache.get(`swot:${userId}`) as SwotItemSummary[] | null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Run all independent queries in parallel
  const [swotItems, goals, tasks, followUps, signals, profile] = await Promise.all([
    // SWOT items (cached or fresh)
    cachedSwot
      ? Promise.resolve(cachedSwot)
      : prisma.swotItem.findMany({
          where: { userId, status: { not: "RETIRED" } },
          select: {
            id: true,
            category: true,
            title: true,
            description: true,
            confidence: true,
            status: true,
            signalCount: true,
            lastUpdatedAt: true,
          },
          orderBy: { confidence: "desc" },
          take: 20,
        }),

    // Goals with task counts
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        progress: true,
        dueDate: true,
        tasks: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Pending / overdue tasks
    prisma.task.findMany({
      where: {
        userId,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        goal: { select: { title: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 10,
    }),

    // Pending follow-ups
    prisma.followUp.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "ASKED"] },
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        question: true,
        context: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Recent signals (last 7 days)
    prisma.signal.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        category: true,
        confidence: true,
        status: true,
        reason: true,
        recurrenceCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),

    // User profile (cached or fresh)
    cachedProfile
      ? Promise.resolve(cachedProfile)
      : prisma.userProfile.findUnique({
          where: { userId },
          select: {
            academicBackground: true,
            goalsSummary: true,
            interests: true,
            habits: true,
            challenges: true,
            currentStreak: true,
            longestStreak: true,
            lastActiveAt: true,
          },
        }),
  ]);

  // Process goals with task completion percentages
  const goalsWithProgress: GoalWithProgress[] = goals.map((g) => {
    const tasksDone = g.tasks.filter((t) => t.status === "DONE").length;
    return {
      id: g.id,
      title: g.title,
      description: g.description,
      status: g.status,
      progress: g.progress,
      dueDate: g.dueDate,
      tasksDone,
      tasksTotal: g.tasks.length,
    };
  });

  // Process tasks
  const taskSummaries: TaskSummary[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    goalTitle: t.goal?.title ?? null,
  }));

  // Cache fresh data
  if (!cachedSwot) {
    swotCache.set(`swot:${userId}`, swotItems);
  }

  const profileData: ProfileSnapshot = profile
    ? {
        academicBackground: profile.academicBackground,
        goalsSummary: profile.goalsSummary,
        interests: profile.interests,
        habits: profile.habits,
        challenges: profile.challenges,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        lastActiveAt: profile.lastActiveAt,
      }
    : {
        academicBackground: null,
        goalsSummary: null,
        interests: [],
        habits: [],
        challenges: [],
        currentStreak: 0,
        longestStreak: 0,
        lastActiveAt: new Date(),
      };

  if (!cachedProfile) {
    profileCache.set(`profile:${userId}`, profileData);
  }

  return {
    swotItems: swotItems as SwotItemSummary[],
    goals: goalsWithProgress,
    tasks: taskSummaries,
    followUps: followUps as FollowUpItem[],
    signals: signals as SignalSummary[],
    profile: profileData,
    streakInfo: {
      currentStreak: profileData.currentStreak,
      longestStreak: profileData.longestStreak,
      lastActiveAt: profileData.lastActiveAt,
    },
  };
}
