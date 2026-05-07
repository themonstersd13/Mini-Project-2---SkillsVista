import { getUnifiedMemory, type UnifiedMemory } from "@/lib/memory/memory-manager";
import { getProactiveHints } from "./proactive-engine";
import type { MessageSummary } from "@/lib/memory/short-term";
import type {
  SwotItemSummary,
  GoalWithProgress,
  TaskSummary,
  FollowUpItem,
  SignalSummary,
  ProfileSnapshot,
  StreakData,
} from "@/lib/memory/structured-memory";
import type { PastConversation } from "@/lib/memory/semantic-memory";
import { prisma } from "@/lib/db";

export type SessionSummary = {
  id: string;
  startedAt: Date;
  lastMessageAt: Date;
  summary: string | null;
  messageCount: number;
};

export type CoachContext = {
  recentMessages: MessageSummary[];
  activeSwotItems: SwotItemSummary[];
  recentSignals: SignalSummary[];
  goals: GoalWithProgress[];
  tasks: TaskSummary[];
  followUps: FollowUpItem[];
  semanticMemory: PastConversation[];
  userProfile: ProfileSnapshot;
  moodTrajectory: number[];
  streakInfo: StreakData;
  proactiveHints: string[];
  sessionHistory: SessionSummary[];
};

/**
 * Build the complete coach context for a user.
 * This is the RAG retrieval layer — no LLM calls, only DB queries + in-memory search.
 */
export async function buildCoachContext(
  userId: string,
  sessionId: string | null,
  currentMessage: string,
): Promise<CoachContext> {
  // Parallel fetch: unified memory + session history + proactive hints
  const [memory, sessionHistory, proactiveHints] = await Promise.all([
    getUnifiedMemory(userId, sessionId, currentMessage),
    prisma.session.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      select: {
        id: true,
        startedAt: true,
        lastMessageAt: true,
        summary: true,
        messageCount: true,
      },
    }),
    getProactiveHints(userId),
  ]);

  return {
    recentMessages: memory.shortTerm.recentMessages,
    activeSwotItems: memory.structured.swotItems,
    recentSignals: memory.structured.signals,
    goals: memory.structured.goals,
    tasks: memory.structured.tasks,
    followUps: memory.structured.followUps,
    semanticMemory: memory.semantic.relevantPastConversations,
    userProfile: memory.structured.profile,
    moodTrajectory: memory.shortTerm.moodTrajectory,
    streakInfo: memory.structured.streakInfo,
    proactiveHints,
    sessionHistory,
  };
}

/**
 * Serialize CoachContext into a structured system prompt section.
 * This text is injected into the LLM prompt for RAG.
 */
export function serializeContextForPrompt(ctx: CoachContext): string {
  const sections: string[] = [];

  // User profile
  if (ctx.userProfile.academicBackground || ctx.userProfile.goalsSummary) {
    sections.push(
      "=== USER PROFILE ===",
      ctx.userProfile.academicBackground
        ? `Background: ${ctx.userProfile.academicBackground}`
        : "",
      ctx.userProfile.goalsSummary
        ? `Goals Summary: ${ctx.userProfile.goalsSummary}`
        : "",
      ctx.userProfile.interests.length > 0
        ? `Interests: ${ctx.userProfile.interests.join(", ")}`
        : "",
      ctx.userProfile.challenges.length > 0
        ? `Known Challenges: ${ctx.userProfile.challenges.join(", ")}`
        : "",
    );
  }

  // Streak info
  sections.push(
    `\n=== ACTIVITY ===`,
    `Current streak: ${ctx.streakInfo.currentStreak} days`,
    `Longest streak: ${ctx.streakInfo.longestStreak} days`,
  );

  // Mood trajectory
  if (ctx.moodTrajectory.length > 0) {
    sections.push(
      `\n=== MOOD TRAJECTORY (recent → oldest) ===`,
      ctx.moodTrajectory.join(" → "),
    );
  }

  // SWOT items
  if (ctx.activeSwotItems.length > 0) {
    sections.push(
      `\n=== ACTIVE SWOT ITEMS ===`,
      ...ctx.activeSwotItems.map(
        (s) =>
          `- [${s.category}] ${s.title} (confidence: ${(s.confidence * 100).toFixed(0)}%, status: ${s.status}, signals: ${s.signalCount})`,
      ),
    );
  }

  // Goals
  if (ctx.goals.length > 0) {
    sections.push(
      `\n=== ACTIVE GOALS ===`,
      ...ctx.goals.map(
        (g) =>
          `- ${g.title} (progress: ${(g.progress * 100).toFixed(0)}%, tasks: ${g.tasksDone}/${g.tasksTotal} done${g.dueDate ? `, due: ${g.dueDate.toISOString().split("T")[0]}` : ""})`,
      ),
    );
  }

  // Pending tasks
  if (ctx.tasks.length > 0) {
    const overdue = ctx.tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date(),
    );
    const upcoming = ctx.tasks.filter(
      (t) => !t.dueDate || new Date(t.dueDate) >= new Date(),
    );

    if (overdue.length > 0) {
      sections.push(
        `\n=== OVERDUE TASKS ===`,
        ...overdue.map(
          (t) =>
            `- ${t.title} (was due: ${t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "no date"}, goal: ${t.goalTitle ?? "standalone"})`,
        ),
      );
    }

    if (upcoming.length > 0) {
      sections.push(
        `\n=== PENDING TASKS ===`,
        ...upcoming.slice(0, 5).map(
          (t) =>
            `- ${t.title} (priority: ${t.priority}, goal: ${t.goalTitle ?? "standalone"})`,
        ),
      );
    }
  }

  // Follow-ups
  if (ctx.followUps.length > 0) {
    sections.push(
      `\n=== PENDING FOLLOW-UPS (you asked these questions before, check if user addressed them) ===`,
      ...ctx.followUps.map((f) => `- "${f.question}"`),
    );
  }

  // Recent signals
  if (ctx.recentSignals.length > 0) {
    sections.push(
      `\n=== RECENT SIGNALS (last 7 days) ===`,
      ...ctx.recentSignals.slice(0, 8).map(
        (s) =>
          `- [${s.category}] ${s.title}: ${s.reason} (confidence: ${(s.confidence * 100).toFixed(0)}%, recurrence: ${s.recurrenceCount}x, status: ${s.status})`,
      ),
    );
  }

  // Semantic memory (past relevant conversations)
  if (ctx.semanticMemory.length > 0) {
    sections.push(
      `\n=== RELEVANT PAST CONVERSATIONS ===`,
      ...ctx.semanticMemory.map(
        (p) =>
          `- [${p.periodStart.toISOString().split("T")[0]}] ${p.summary}${p.keyInsights.length > 0 ? ` | Key insight: ${p.keyInsights[0]}` : ""}`,
      ),
    );
  }

  // Proactive hints
  if (ctx.proactiveHints.length > 0) {
    sections.push(
      `\n=== PROACTIVE HINTS (consider weaving these into your response naturally) ===`,
      ...ctx.proactiveHints.map((h) => `- ${h}`),
    );
  }

  return sections.filter(Boolean).join("\n");
}
