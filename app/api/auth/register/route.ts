import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/schemas/auth";
import { setSessionCookie, signSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = registerSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        displayName: parsed.data.displayName,
        profile: {
          create: {
            onboardingComplete: false,
          },
        },
      },
    });

    const token = await signSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      onboardingComplete: false,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to register", detail: String(error) }, { status: 500 });
  }
}
