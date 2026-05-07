import { NextResponse } from "next/server";
import { SWOTCategory, SWOTStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/server/auth-helpers";
import { onboardingSchema } from "@/lib/schemas/onboarding";
import { writeAuditLog } from "@/lib/server/audit";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = onboardingSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.userProfile.upsert({
      where: { userId: auth.userId },
      update: {
        academicBackground: parsed.data.academicBackground,
        goalsSummary: parsed.data.goalsSummary,
        interests: parsed.data.interests,
        habits: parsed.data.habits,
        challenges: parsed.data.challenges,
        onboardingComplete: true,
      },
      create: {
        userId: auth.userId,
        academicBackground: parsed.data.academicBackground,
        goalsSummary: parsed.data.goalsSummary,
        interests: parsed.data.interests,
        habits: parsed.data.habits,
        challenges: parsed.data.challenges,
        onboardingComplete: true,
      },
    });

    const initialSwot = [
      {
        category: SWOTCategory.STRENGTH,
        title: "Self-awareness baseline",
        description: "Completed reflective onboarding with clear growth goals.",
      },
      {
        category: SWOTCategory.WEAKNESS,
        title: "Consistency uncertainty",
        description: "Initial profile indicates some routine instability to monitor.",
      },
      {
        category: SWOTCategory.OPPORTUNITY,
        title: "Goal-driven momentum",
        description: "Defined goals create clear room for targeted progress.",
      },
      {
        category: SWOTCategory.THREAT,
        title: "Academic overload risk",
        description: "Potential overload from competing priorities if unmanaged.",
      },
    ];

    for (const item of initialSwot) {
      const exists = await prisma.swotItem.findFirst({
        where: {
          userId: auth.userId,
          category: item.category,
          title: item.title,
        },
      });

      if (exists) {
        continue;
      }

      const created = await prisma.swotItem.create({
        data: {
          userId: auth.userId,
          category: item.category,
          title: item.title,
          description: item.description,
          confidence: 0.62,
          status: SWOTStatus.UNCERTAIN,
        },
      });

      await prisma.swotItemVersion.create({
        data: {
          swotItemId: created.id,
          changedBy: "system",
          reason: "Bootstrapped after onboarding",
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
    }

    await writeAuditLog({
      userId: auth.userId,
      action: "ONBOARDING_COMPLETED",
      entityType: "UserProfile",
      entityId: auth.userId,
      actor: "user",
      details: {
        interests: parsed.data.interests.length,
        challenges: parsed.data.challenges.length,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save onboarding", detail: String(error) }, { status: 500 });
  }
}
