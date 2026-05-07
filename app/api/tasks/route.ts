import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";
import { z } from "zod";

const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  goalId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional(),
});

const taskUpdateSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "MISSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const tasks = await prisma.task.findMany({
    where: { userId: auth.userId },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      goal: { select: { title: true } },
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = taskCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const task = await prisma.task.create({
      data: {
        userId: auth.userId,
        title: parsed.data.title,
        goalId: parsed.data.goalId,
        priority: parsed.data.priority ?? "MEDIUM",
        dueDate: parsed.data.dueDate
          ? new Date(parsed.data.dueDate)
          : undefined,
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task", detail: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as {
      taskId?: string;
      status?: string;
      priority?: string;
      dueDate?: string | null;
    };

    if (!payload.taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }

    const parsed = taskUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const task = await prisma.task.update({
      where: { id: payload.taskId },
      data: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.priority && { priority: parsed.data.priority }),
        ...(parsed.data.dueDate !== undefined && {
          dueDate: parsed.data.dueDate
            ? new Date(parsed.data.dueDate)
            : null,
        }),
        ...(parsed.data.status === "DONE" && { completedAt: new Date() }),
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task", detail: String(error) },
      { status: 500 },
    );
  }
}
