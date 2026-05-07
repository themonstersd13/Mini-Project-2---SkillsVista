import { getShortTermMemory, type ShortTermContext } from "./short-term";
import { getStructuredMemory, type StructuredContext } from "./structured-memory";
import { getSemanticMemory, type SemanticContext } from "./semantic-memory";
import { storeEmbedding } from "./embedding-service";
import { profileCache, swotCache } from "./cache";
import { prisma } from "@/lib/db";

export type UnifiedMemory = {
  shortTerm: ShortTermContext;
  structured: StructuredContext;
  semantic: SemanticContext;
};

/**
 * Central memory manager — retrieves all memory layers in parallel.
 */
export async function getUnifiedMemory(
  userId: string,
  sessionId: string | null,
  currentMessage: string,
): Promise<UnifiedMemory> {
  // Fetch all three memory layers in parallel for minimum latency
  const [shortTerm, structured, semantic] = await Promise.all([
    getShortTermMemory(userId, sessionId),
    getStructuredMemory(userId),
    getSemanticMemory(userId, currentMessage),
  ]);

  return { shortTerm, structured, semantic };
}

/**
 * Store conversation turn as an embedding for future semantic retrieval.
 * This runs in the background — does NOT block the response.
 */
export function storeConversationEmbeddingAsync(
  userId: string,
  userMessage: string,
  assistantReply: string,
  sessionId: string | null,
): void {
  const content = `User: ${userMessage}\nAssistant: ${assistantReply}`;
  const sourceRef = sessionId ? `session:${sessionId}` : `chat:${Date.now()}`;

  // Fire and forget — don't await
  storeEmbedding(userId, content, sourceRef).catch((error) => {
    console.warn("Background embedding storage failed:", error);
  });
}

/**
 * Create or update a conversation summary for long-term memory.
 * Called periodically (e.g., every 10 messages or on session close).
 */
export async function storeConversationSummary(
  userId: string,
  sessionId: string | null,
  summary: string,
  topics: string[],
  keyInsights: string[],
  messageCount: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  await prisma.conversationSummary.create({
    data: {
      userId,
      sessionId,
      summary,
      topics,
      keyInsights,
      messageCount,
      periodStart,
      periodEnd,
    },
  });

  // Also store as an embedding for vector search
  const embeddingContent = [
    `Summary: ${summary}`,
    `Topics: ${topics.join(", ")}`,
    `Key Insights: ${keyInsights.join("; ")}`,
  ].join("\n");

  storeEmbedding(userId, embeddingContent, `summary:${sessionId ?? Date.now()}`).catch(
    (error) => {
      console.warn("Summary embedding storage failed:", error);
    },
  );
}

/**
 * Invalidate caches for a user (call after mutations).
 */
export function invalidateUserCaches(userId: string): void {
  profileCache.invalidate(`profile:${userId}`);
  swotCache.invalidate(`swot:${userId}`);
}
