import { prisma } from "@/lib/db";

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIM = 768;

/**
 * Generate an embedding vector using Gemini's embedding API.
 * Uses gemini-embedding-2 with Matryoshka output_dimensionality=768 for compact storage.
 * Returns null if the API key is missing or the call fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );

    if (!response.ok) {
      console.warn("Embedding API failed:", response.status);
      return null;
    }

    const data = (await response.json()) as {
      embedding?: { values?: number[] };
    };

    return data.embedding?.values ?? null;
  } catch (error) {
    console.warn("Embedding generation error:", error);
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Store an embedding for a piece of content (background, non-blocking).
 */
export async function storeEmbedding(
  userId: string,
  content: string,
  sourceRef: string,
): Promise<void> {
  try {
    const vector = await generateEmbedding(content);
    if (!vector) {
      return;
    }

    await prisma.contextEmbedding.create({
      data: {
        userId,
        sourceRef,
        content: content.slice(0, 2000), // Truncate for storage
        embedding: vector,
      },
    });
  } catch (error) {
    console.warn("Failed to store embedding:", error);
  }
}

/**
 * Find the top-K most similar past contexts for a query.
 * Loads all user embeddings into memory and computes cosine similarity.
 */
export async function findSimilarContexts(
  userId: string,
  queryText: string,
  topK = 3,
): Promise<Array<{ content: string; sourceRef: string; similarity: number }>> {
  const queryVector = await generateEmbedding(queryText);
  if (!queryVector) {
    return [];
  }

  const embeddings = await prisma.contextEmbedding.findMany({
    where: { userId },
    select: {
      content: true,
      sourceRef: true,
      embedding: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500, // Cap to prevent memory issues
  });

  if (embeddings.length === 0) {
    return [];
  }

  const scored = embeddings
    .map((e) => {
      const storedVector = e.embedding as number[];
      if (!Array.isArray(storedVector) || storedVector.length !== EMBEDDING_DIM) {
        return null;
      }

      return {
        content: e.content,
        sourceRef: e.sourceRef,
        similarity: cosineSimilarity(queryVector, storedVector),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Filter out low-similarity results
  return scored.filter((s) => s.similarity > 0.3);
}
