import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-helpers";
import {
  getWeeklyAssessmentData,
  submitWeeklyAssessment,
} from "@/lib/server/weekly-assessment-service";
import { submitWeeklyAssessmentSchema } from "@/lib/schemas/weekly-assessment";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const data = await getWeeklyAssessmentData(auth.userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = submitWeeklyAssessmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await submitWeeklyAssessment(auth.userId, parsed.data.answers);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit weekly assessment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
