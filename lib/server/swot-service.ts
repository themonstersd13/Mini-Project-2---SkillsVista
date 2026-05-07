import { MessageRole, SWOTStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/server/audit";
import { detectMoodScore, extractCandidates, type CandidateSignal } from "@/lib/ai/pipeline";
import { buildCoachContext } from "@/lib/ai/context-builder";
import { composeCoachReply } from "@/lib/ai/chat-provider";
import { parseStructuredResponse } from "@/lib/ai/response-formatter";
import {
  validateSignal,
  recordSignal,
  type CandidateSignal as ValidatorSignal,
} from "@/lib/ai/signal-validator";
import {
  storeConversationEmbeddingAsync,
  invalidateUserCaches,
} from "@/lib/memory/memory-manager";
import {
  getOrCreateSession,
  touchSession,
  updateUserStreak,
} from "@/lib/server/session-service";
import {
  createFollowUps,
  matchFollowUps,
} from "@/lib/server/follow-up-service";

const CONFIDENCE_MUTATION_THRESHOLD = 0.72;

function computeStaleStatus(lastUpdatedAt: Date, staleAfterDays: number): SWOTStatus {
  const staleDate = new Date(lastUpdatedAt);
  staleDate.setDate(staleDate.getDate() + staleAfterDays);
  return staleDate < new Date() ? SWOTStatus.STALE : SWOTStatus.ACTIVE;
}

async function applyCandidate(userId: string, candidate: CandidateSignal) {
  const existing = await prisma.swotItem.findFirst({
    where: {
      userId,
      title: candidate.title,
      category: candidate.category,
    },
  });

  if (!existing && candidate.confidence < CONFIDENCE_MUTATION_THRESHOLD) {
    return {
      title: candidate.title,
      status: "UNCHANGED",
      reason: "Insufficient confidence for creation",
    };
  }

  if (!existing) {
    const created = await prisma.swotItem.create({
      data: {
        userId,
        title: candidate.title,
        category: candidate.category,
        description: candidate.reason,
        confidence: candidate.confidence,
        status: SWOTStatus.ACTIVE,
        signalCount: 1,
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.evidence.create({
      data: {
        userId,
        swotItemId: created.id,
        type: candidate.evidenceType,
        source: "chat",
        excerpt: candidate.evidenceExcerpt,
        score: candidate.confidence,
      },
    });

    await prisma.swotItemVersion.create({
      data: {
        swotItemId: created.id,
        changedBy: "system",
        reason: "Created from validated chat evidence",
        confidenceFrom: 0,
        confidenceTo: created.confidence,
        statusFrom: SWOTStatus.UNCERTAIN,
        statusTo: created.status,
        snapshot: {
          title: created.title,
          description: created.description,
        },
      },
    });

    await writeAuditLog({
      userId,
      action: "SWOT_CREATED",
      entityType: "SwotItem",
      entityId: created.id,
      actor: "system",
      details: {
        confidence: created.confidence,
        reason: candidate.reason,
      },
    });

    // Invalidate SWOT cache
    invalidateUserCaches(userId);

    return {
      title: candidate.title,
      status: "CREATED",
      reason: candidate.reason,
    };
  }

  const oldConfidence = existing.confidence;
  const newConfidence = Math.min(0.98, existing.confidence * 0.65 + candidate.confidence * 0.35 + 0.08);
  const provisionalStatus = newConfidence < 0.68 ? SWOTStatus.UNCERTAIN : SWOTStatus.ACTIVE;

  const updated = await prisma.swotItem.update({
    where: { id: existing.id },
    data: {
      confidence: newConfidence,
      status: provisionalStatus,
      signalCount: existing.signalCount + 1,
      lastUpdatedAt: new Date(),
      description: candidate.reason,
    },
  });

  await prisma.evidence.create({
    data: {
      userId,
      swotItemId: updated.id,
      type: candidate.evidenceType,
      source: "chat",
      excerpt: candidate.evidenceExcerpt,
      score: candidate.confidence,
    },
  });

  await prisma.swotItemVersion.create({
    data: {
      swotItemId: updated.id,
      changedBy: "system",
      reason: "Confidence and evidence refresh from chat",
      confidenceFrom: oldConfidence,
      confidenceTo: newConfidence,
      statusFrom: existing.status,
      statusTo: updated.status,
      snapshot: {
        title: updated.title,
        description: updated.description,
        signalCount: updated.signalCount,
      },
    },
  });

  await writeAuditLog({
    userId,
    action: "SWOT_UPDATED",
    entityType: "SwotItem",
    entityId: updated.id,
    actor: "system",
    details: {
      from: oldConfidence,
      to: newConfidence,
      reason: candidate.reason,
    },
  });

  // Invalidate SWOT cache
  invalidateUserCaches(userId);

  return {
    title: updated.title,
    status: "UPDATED",
    reason: candidate.reason,
  };
}

async function retireStaleItems(userId: string) {
  const items = await prisma.swotItem.findMany({
    where: {
      userId,
      status: {
        not: SWOTStatus.RETIRED,
      },
    },
  });

  const updates: Array<{ title: string; status: string; reason: string }> = [];

  for (const item of items) {
    const staleStatus = computeStaleStatus(item.lastUpdatedAt, item.staleAfterDays);
    if (staleStatus === SWOTStatus.STALE && item.status !== SWOTStatus.STALE) {
      await prisma.swotItem.update({
        where: { id: item.id },
        data: {
          status: SWOTStatus.STALE,
        },
      });

      await prisma.swotItemVersion.create({
        data: {
          swotItemId: item.id,
          changedBy: "system",
          reason: "Item became stale due to inactivity",
          confidenceFrom: item.confidence,
          confidenceTo: item.confidence,
          statusFrom: item.status,
          statusTo: SWOTStatus.STALE,
          snapshot: {
            title: item.title,
          },
        },
      });

      await writeAuditLog({
        userId,
        action: "SWOT_STALE",
        entityType: "SwotItem",
        entityId: item.id,
        actor: "system",
        details: {
          title: item.title,
        },
      });

      updates.push({
        title: item.title,
        status: "STALE",
        reason: "No reinforcing evidence in recent window",
      });
    }

    const staleForLong = new Date(item.lastUpdatedAt);
    staleForLong.setDate(staleForLong.getDate() + item.staleAfterDays * 2);
    if (staleForLong < new Date() && item.status === SWOTStatus.STALE) {
      await prisma.swotItem.update({
        where: { id: item.id },
        data: {
          status: SWOTStatus.RETIRED,
          retiredAt: new Date(),
        },
      });

      updates.push({
        title: item.title,
        status: "RETIRED",
        reason: "Stale period exceeded retirement threshold",
      });
    }
  }

  if (updates.length > 0) {
    invalidateUserCaches(userId);
  }

  return updates;
}

/**
 * Main chat processing pipeline — the core intelligence layer.
 *
 * Flow:
 * 1. Get/create session
 * 2. Match pending follow-ups
 * 3. Build full RAG context
 * 4. Single LLM call (response + signal extraction)
 * 5. Parse structured output
 * 6. Validate extracted signals
 * 7. Apply validated signals to SWOT
 * 8. Create follow-ups for uncertain signals
 * 9. Background: store embedding, update streak
 * 10. Return response
 */
export async function processChat(userId: string, message: string) {
  // Step 1: Session management
  const { id: sessionId, isNew: isNewSession } = await getOrCreateSession(userId);

  // Step 2: Match pending follow-ups (non-blocking check)
  const matchedFollowUps = await matchFollowUps(userId, message);

  // Step 3: Build full RAG context
  const coachContext = await buildCoachContext(userId, sessionId, message);

  // Step 4: Detect mood
  const moodScore = detectMoodScore(message);

  // Step 5: Save user message
  const userMsg = await prisma.chatMessage.create({
    data: {
      userId,
      sessionId,
      role: MessageRole.USER,
      content: message,
      moodScore,
      isCheckIn: /(today|week|progress|check-in)/i.test(message),
      patternSignalScore: Math.abs(moodScore) >= 2 ? 0.4 : 0.65,
    },
  });

  // Update session
  await touchSession(sessionId);

  // Step 6: Single LLM call with full context
  const rawReply = await composeCoachReply(coachContext, message);

  // Step 7: Parse structured response
  const structured = parseStructuredResponse(rawReply);
  const assistantMessage = structured.userResponse;

  // Step 8: Process signals — validate LLM-extracted signals, fall back to rule-based
  const allSignals: ValidatorSignal[] = structured.signals.length > 0
    ? structured.signals
    : extractCandidates(message, {
        activeGoals: coachContext.goals.map((g) => g.title),
        recentMessages: coachContext.recentMessages.map((m) => m.content),
      });

  const updates: Array<{ title: string; status: string; reason: string }> = [];
  const followUpQuestions: string[] = [...structured.followUps];

  for (const signal of allSignals) {
    // Validate each signal
    const validation = await validateSignal(userId, signal);

    if (validation.validationScore >= CONFIDENCE_MUTATION_THRESHOLD) {
      // Apply to SWOT
      const applied = await applyCandidate(userId, signal);
      updates.push(applied);
      await recordSignal(userId, signal, "VALIDATED");
    } else if (validation.shouldAsk && validation.followUpQuestion) {
      // Uncertain — create follow-up instead
      followUpQuestions.push(validation.followUpQuestion);
      await recordSignal(userId, signal, "PENDING");
    } else {
      // Too low confidence — just record for history
      await recordSignal(userId, signal, "PENDING");
    }
  }

  // Step 9: Retire stale items
  const staleUpdates = await retireStaleItems(userId);
  updates.push(...staleUpdates);

  // Step 10: Save assistant message
  const savedAssistantMessage = await prisma.chatMessage.create({
    data: {
      userId,
      sessionId,
      role: MessageRole.ASSISTANT,
      content: assistantMessage,
      moodScore: structured.moodAssessment,
      isCheckIn: true,
      patternSignalScore: 0.7,
      contextSnapshot: {
        goalsCount: coachContext.goals.length,
        swotCount: coachContext.activeSwotItems.length,
        followUpsCount: coachContext.followUps.length,
        proactiveHints: coachContext.proactiveHints.length,
        semanticHits: coachContext.semanticMemory.length,
        matchedFollowUps: matchedFollowUps.length,
      },
    },
  });

  // Step 11: Create follow-ups (if any)
  if (followUpQuestions.length > 0) {
    await createFollowUps(userId, followUpQuestions.slice(0, 3));
  }

  // Step 12: Background tasks (non-blocking)
  storeConversationEmbeddingAsync(userId, message, assistantMessage, sessionId);
  updateUserStreak(userId).catch((err) =>
    console.warn("Streak update failed:", err),
  );

  // Audit log
  await writeAuditLog({
    userId,
    action: "CHAT_PROCESSED",
    entityType: "ChatMessage",
    entityId: savedAssistantMessage.id,
    actor: "system",
    details: {
      sessionId,
      isNewSession,
      signalCount: allSignals.length,
      validatedCount: updates.filter((u) => u.status !== "UNCHANGED").length,
      followUpCount: followUpQuestions.length,
      moodScore,
      matchedFollowUps: matchedFollowUps.length,
    },
  });

  return {
    message: savedAssistantMessage,
    updates,
    moodScore,
    sessionId,
    isNewSession,
    signals: allSignals,
  };
}
