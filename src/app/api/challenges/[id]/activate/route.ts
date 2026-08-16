import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activateChallenge } from "@/lib/challenges";

export async function POST(request: Request, context: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const params = await context.params;
    const challengeId = params.id;

    // Без Strava нечего засчитывать — активировать цель нет смысла.
    const stravaAccount = await prisma.account.findFirst({ where: { userId, provider: "strava" } });
    if (!stravaAccount) {
      return NextResponse.json({ error: "STRAVA_REQUIRED" }, { status: 409 });
    }

    const { participation } = await activateChallenge(userId, challengeId);
    return NextResponse.json({ success: true, participation });
  } catch (error: any) {
    if (error?.message === "CHALLENGE_NOT_FOUND") {
      return NextResponse.json({ error: "Цель не найдена" }, { status: 404 });
    }
    if (error?.message === "ALREADY_COMPLETED") {
      return NextResponse.json({ error: "Эта цель уже выполнена" }, { status: 409 });
    }
    if (error?.message === "PROMO_EXHAUSTED") {
      return NextResponse.json({ error: "Промокоды закончились" }, { status: 409 });
    }
    console.error("POST /api/challenges/[id]/activate error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
