import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const signals = await prisma.signal.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      category: true,
      confidence: true,
      status: true,
      reason: true,
      recurrenceCount: true,
      evidenceType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ signals });
}
