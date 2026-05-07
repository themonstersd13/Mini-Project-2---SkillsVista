import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";

type RequireUserResult =
  | { userId: string; response: null }
  | { userId: null; response: NextResponse };

export async function requireUser(): Promise<RequireUserResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    userId,
    response: null,
  };
}
