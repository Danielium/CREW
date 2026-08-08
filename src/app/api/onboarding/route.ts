import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ seenMask: null });

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { onboardingSeenMask: true },
  });

  // Unknown user: treat as "everything seen" so we never flash hints at a broken session.
  return NextResponse.json({ seenMask: user?.onboardingSeenMask ?? null });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId } = await req.json();
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) return NextResponse.json({ error: "Unknown step" }, { status: 400 });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingSeenMask: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const seenMask = user.onboardingSeenMask | step.bit;
  await prisma.user.update({ where: { id: userId }, data: { onboardingSeenMask: seenMask } });

  return NextResponse.json({ seenMask });
}
