import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";
import { chatMessageSchema } from "@/lib/schemas/chat";
import { processChat } from "@/lib/server/swot-service";
import {
  getOrCreateSession,
  getSessionHistory,
} from "@/lib/server/session-service";
import { getPendingFollowUps } from "@/lib/server/follow-up-service";
import { getProactiveHints } from "@/lib/ai/proactive-engine";

function sseEvent(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  // Get current session
  const { id: sessionId } = await getOrCreateSession(auth.userId);

  // Parallel fetch: messages, sessions, follow-ups, proactive hints, profile
  const [messages, sessionHistory, followUps, proactiveHints, profile] =
    await Promise.all([
      prisma.chatMessage.findMany({
        where: { userId: auth.userId, sessionId },
        orderBy: { createdAt: "asc" },
        take: 80,
      }),
      getSessionHistory(auth.userId, 10),
      getPendingFollowUps(auth.userId),
      getProactiveHints(auth.userId),
      prisma.userProfile.findUnique({
        where: { userId: auth.userId },
        select: {
          currentStreak: true,
          longestStreak: true,
          lastActiveAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    messages,
    sessionId,
    sessionHistory,
    followUps,
    proactiveHints,
    streak: profile
      ? {
          current: profile.currentStreak,
          longest: profile.longestStreak,
          lastActive: profile.lastActiveAt,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const wantsSse =
      request.headers.get("accept")?.includes("text/event-stream") ?? false;

    if (wantsSse) {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();

          try {
            controller.enqueue(
              encoder.encode(sseEvent("start", { ok: true })),
            );

            const result = await processChat(
              auth.userId,
              parsed.data.message,
            );
            const content = result.message.content;
            const chunks = content.match(/.{1,24}(\s|$)/g) ?? [content];

            for (const chunk of chunks) {
              controller.enqueue(
                encoder.encode(sseEvent("token", { text: chunk })),
              );
              await new Promise((resolve) => setTimeout(resolve, 12));
            }

            controller.enqueue(
              encoder.encode(
                sseEvent("done", {
                  message: result.message,
                  updates: result.updates,
                  moodScore: result.moodScore,
                  sessionId: result.sessionId,
                  isNewSession: result.isNewSession,
                  signals: result.signals,
                }),
              ),
            );
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                sseEvent("error", {
                  error: "Failed to process chat",
                  detail: String(error),
                }),
              ),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const result = await processChat(auth.userId, parsed.data.message);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process chat", detail: String(error) },
      { status: 500 },
    );
  }
}
