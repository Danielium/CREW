import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    const challenges = await prisma.challenge.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    let active: any = null;
    let paused: any[] = [];
    let completed: any = null;
    let visibleChallenges = challenges;
    let stravaConnected = false;

    if (userId) {
      const [participations, stravaAccount] = await Promise.all([
        prisma.challengeParticipation.findMany({
          where: { userId, status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
          include: { challenge: true },
          orderBy: { completedAt: "desc" },
        }),
        prisma.account.findFirst({ where: { userId, provider: "strava" } }),
      ]);

      active = participations.find((p) => p.status === "ACTIVE") ?? null;
      paused = participations.filter((p) => p.status === "PAUSED");
      completed = participations.find((p) => p.status === "COMPLETED") ?? null;
      stravaConnected = !!stravaAccount;

      // Уже выполненную цель нельзя брать повторно — второй промокод за ту
      // же цель не положен, поэтому не показываем её в каталоге.
      const completedIds = new Set(participations.filter((p) => p.status === "COMPLETED").map((p) => p.challengeId));
      visibleChallenges = challenges.filter((c) => !completedIds.has(c.id));
    }

    return NextResponse.json({ challenges: visibleChallenges, active, paused, completed, stravaConnected });
  } catch (error) {
    console.error("GET /api/challenges error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
