import { prisma } from "@/lib/db";

export type MessageSummary = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  moodScore: number | null;
  createdAt: Date;
};

export type ShortTermContext = {
  recentMessages: MessageSummary[];
  moodTrajectory: number[];
  lastTopic: string | null;
  pendingFollowUp: boolean;
};

/**
 * Retrieves short-term memory: recent messages from the current session,
 * mood trajectory, and conversation flow state.
 */
export async function getShortTermMemory(
  userId: string,
  sessionId: string | null,
): Promise<ShortTermContext> {
  const whereClause = sessionId
    ? { userId, sessionId }
    : { userId };

  const recentMessages = await prisma.chatMessage.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      role: true,
      content: true,
      moodScore: true,
      createdAt: true,
    },
  });

  // Reverse so oldest is first (chronological order)
  recentMessages.reverse();

  // Extract mood trajectory from user messages with mood scores
  const moodTrajectory = recentMessages
    .filter((m) => m.role === "USER" && m.moodScore !== null)
    .map((m) => m.moodScore as number)
    .slice(-5);

  // Determine last topic from the most recent user message
  const lastUserMessage = recentMessages
    .filter((m) => m.role === "USER")
    .pop();
  const lastTopic = lastUserMessage
    ? lastUserMessage.content.slice(0, 100)
    : null;

  // Check if the last assistant message ended with a question
  const lastAssistantMessage = recentMessages
    .filter((m) => m.role === "ASSISTANT")
    .pop();
  const pendingFollowUp = lastAssistantMessage
    ? lastAssistantMessage.content.trim().endsWith("?")
    : false;

  return {
    recentMessages: recentMessages.map((m) => ({
      id: m.id,
      role: m.role as "USER" | "ASSISTANT" | "SYSTEM",
      content: m.content,
      moodScore: m.moodScore,
      createdAt: m.createdAt,
    })),
    moodTrajectory,
    lastTopic,
    pendingFollowUp,
  };
}
