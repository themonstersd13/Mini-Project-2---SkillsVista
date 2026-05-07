import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-helpers";
import {
  getPendingFollowUps,
  markFollowUpAnswered,
} from "@/lib/server/follow-up-service";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const followUps = await getPendingFollowUps(auth.userId);
  return NextResponse.json({ followUps });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as {
      followUpId?: string;
      answer?: string;
    };

    if (!payload.followUpId) {
      return NextResponse.json(
        { error: "followUpId is required" },
        { status: 400 },
      );
    }

    await markFollowUpAnswered(payload.followUpId, payload.answer);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update follow-up", detail: String(error) },
      { status: 500 },
    );
  }
}
