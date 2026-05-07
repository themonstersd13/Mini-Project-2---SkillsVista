import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/schemas/auth";
import { setSessionCookie, signSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      onboardingComplete: user.profile?.onboardingComplete ?? false,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to login", detail: String(error) }, { status: 500 });
  }
}
