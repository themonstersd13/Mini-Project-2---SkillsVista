import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const [items, tasksCompleted, tasksTotal, streakMessages] = await Promise.all([
    prisma.swotItem.findMany({ where: { userId: auth.userId } }),
    prisma.task.count({ where: { userId: auth.userId, status: "DONE" } }),
    prisma.task.count({ where: { userId: auth.userId } }),
    prisma.chatMessage.findMany({
      where: {
        userId: auth.userId,
        role: "USER",
      },
      orderBy: { createdAt: "desc" },
      take: 14,
    }),
  ]);

  const now = new Date();
  const activeStreak = streakMessages.filter((message: { createdAt: Date }) => {
    const daysAgo = Math.floor((now.getTime() - message.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 6;
  }).length;

  return NextResponse.json({
    counts: {
      strengths: items.filter((item) => item.category === "STRENGTH").length,
      weaknesses: items.filter((item) => item.category === "WEAKNESS").length,
      opportunities: items.filter((item) => item.category === "OPPORTUNITY").length,
      threats: items.filter((item) => item.category === "THREAT").length,
      active: items.filter((item) => item.status === "ACTIVE").length,
      stale: items.filter((item) => item.status === "STALE").length,
    },
    tasks: {
      completed: tasksCompleted,
      total: tasksTotal,
    },
    activityStreak: activeStreak,
  });
}
