import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-helpers";
import {
  getSessionHistory,
  getSessionMessages,
} from "@/lib/server/session-service";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  // If a specific session is requested, return its messages
  if (sessionId) {
    const messages = await getSessionMessages(auth.userId, sessionId);
    return NextResponse.json({ messages });
  }

  // Otherwise return session list
  const sessions = await getSessionHistory(auth.userId, 20);
  return NextResponse.json({ sessions });
}
