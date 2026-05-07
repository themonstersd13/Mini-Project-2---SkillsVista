import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { goalCreateSchema } from "@/lib/schemas/onboarding";
import { requireUser } from "@/lib/server/auth-helpers";
import { z } from "zod";

const goalUpdateSchema = z.object({
  goalId: z.string(),
  progress: z.number().min(0).max(1).optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ABANDONED"]).optional(),
  milestones: z.any().optional(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const [goals, tasks] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        tasks: {
          select: { id: true, title: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.task.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Compute completion percentage for each goal
  const goalsWithCompletion = goals.map((goal) => {
    const totalTasks = goal.tasks.length;
    const completedTasks = goal.tasks.filter((t) => t.status === "DONE").length;
    const completion = totalTasks > 0 ? completedTasks / totalTasks : goal.progress;

    return {
      ...goal,
      completion,
      completedTasks,
      totalTasks,
    };
  });

  return NextResponse.json({ goals: goalsWithCompletion, tasks });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = goalCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: auth.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create goal", detail: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = goalUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const goal = await prisma.goal.update({
      where: { id: parsed.data.goalId },
      data: {
        ...(parsed.data.progress !== undefined && { progress: parsed.data.progress }),
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.milestones && { milestones: parsed.data.milestones }),
      },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update goal", detail: String(error) }, { status: 500 });
  }
}
