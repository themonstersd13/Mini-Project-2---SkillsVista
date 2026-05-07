import { prisma } from "@/lib/db";
import { findSimilarContexts } from "./embedding-service";
import { embeddingQueryCache } from "./cache";

export type PastConversation = {
  summary: string;
  topics: string[];
  keyInsights: string[];
  periodStart: Date;
  periodEnd: Date;
  similarity: number;
};

export type SemanticContext = {
  relevantPastConversations: PastConversation[];
};

/**
 * Retrieve semantically relevant past conversations using vector search.
 * Falls back to recent conversation summaries if embeddings aren't available.
 */
export async function getSemanticMemory(
  userId: string,
  queryText: string,
): Promise<SemanticContext> {
  // Check cache first
  const cacheKey = `semantic:${userId}:${queryText.slice(0, 50)}`;
  const cached = embeddingQueryCache.get(cacheKey) as SemanticContext | null;
  if (cached) {
    return cached;
  }

  // Try vector similarity search
  const similarContexts = await findSimilarContexts(userId, queryText, 3);

  if (similarContexts.length > 0) {
    // Cross-reference with conversation summaries for rich context
    const summaries = await prisma.conversationSummary.findMany({
      where: { userId },
      orderBy: { periodEnd: "desc" },
      take: 20,
      select: {
        summary: true,
        topics: true,
        keyInsights: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    // Match similar contexts to summaries where possible
    const result: PastConversation[] = similarContexts.map((ctx) => {
      const matchingSummary = summaries.find((s) =>
        ctx.content.includes(s.summary.slice(0, 50)),
      );

      return {
        summary: matchingSummary?.summary ?? ctx.content,
        topics: matchingSummary?.topics ?? [],
        keyInsights: matchingSummary?.keyInsights ?? [],
        periodStart: matchingSummary?.periodStart ?? new Date(),
        periodEnd: matchingSummary?.periodEnd ?? new Date(),
        similarity: ctx.similarity,
      };
    });

    const semanticContext = { relevantPastConversations: result };
    embeddingQueryCache.set(cacheKey, semanticContext);
    return semanticContext;
  }

  // Fallback: return most recent conversation summaries
  const recentSummaries = await prisma.conversationSummary.findMany({
    where: { userId },
    orderBy: { periodEnd: "desc" },
    take: 3,
    select: {
      summary: true,
      topics: true,
      keyInsights: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  const fallbackResult: SemanticContext = {
    relevantPastConversations: recentSummaries.map((s) => ({
      ...s,
      similarity: 0.5, // Default similarity for fallback
    })),
  };

  embeddingQueryCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
