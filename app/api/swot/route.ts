import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";
import { getSwotBoard } from "@/lib/server/swot-read-model";
import { writeAuditLog } from "@/lib/server/audit";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const board = await getSwotBoard(auth.userId);
  return NextResponse.json(board);
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as {
      id: string;
      status?: "ACTIVE" | "UNCERTAIN" | "STALE" | "RETIRED";
      confidence?: number;
      description?: string;
    };

    const existing = await prisma.swotItem.findFirst({
      where: {
        id: payload.id,
        userId: auth.userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.swotItem.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        confidence: payload.confidence,
        description: payload.description,
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.swotItemVersion.create({
      data: {
        swotItemId: updated.id,
        changedBy: "user",
        reason: "Manual override from dashboard",
        confidenceFrom: existing.confidence,
        confidenceTo: updated.confidence,
        statusFrom: existing.status,
        statusTo: updated.status,
        snapshot: {
          title: updated.title,
          description: updated.description,
        },
      },
    });

    await writeAuditLog({
      userId: auth.userId,
      action: "SWOT_MANUAL_OVERRIDE",
      entityType: "SwotItem",
      entityId: updated.id,
      actor: "user",
      details: {
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update SWOT", detail: String(error) }, { status: 500 });
  }
}
