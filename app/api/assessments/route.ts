import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-helpers";
import {
  getAssessmentDashboardData,
  submitAssessment,
} from "@/lib/server/assessment-service";
import { submitAssessmentSchema } from "@/lib/schemas/assessment";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const data = await getAssessmentDashboardData(auth.userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = submitAssessmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await submitAssessment(
      auth.userId,
      parsed.data.academicStage,
      parsed.data.answers,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit assessment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
