import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  const item = await prisma.swotItem.findFirst({
    where: {
      id,
      userId: auth.userId,
    },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
      },
      evidence: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      confidence: item.confidence,
      lastUpdatedAt: item.lastUpdatedAt,
    },
    versions: item.versions,
    evidence: item.evidence,
  });
}
