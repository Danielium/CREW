import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    const [challenges, participations, stravaAccount] = await Promise.all([
      prisma.challenge.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
      userId
        ? prisma.challengeParticipation.findMany({
            where: { userId, status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
            include: { challenge: true },
            orderBy: { completedAt: "desc" },
          })
        : Promise.resolve([] as any[]),
      userId ? prisma.account.findFirst({ where: { userId, provider: "strava" } }) : Promise.resolve(null),
    ]);

    // Остаток промокодов нужен и в каталоге, и на карточках участия
    // (активная/приостановленные/выполненная) — их challenge приходит из
    // отдельного include и не проходит через тот же map, что каталог,
    // поэтому считаем по объединению id-шников сразу и прикладываем везде.
    const allPromoIds = new Set<string>();
    for (const c of challenges) if (c.claimType === "PROMO") allPromoIds.add(c.id);
    for (const p of participations) if (p.challenge.claimType === "PROMO") allPromoIds.add(p.challengeId);

    const remainingCounts = allPromoIds.size
      ? await prisma.promoCode.groupBy({
          by: ["challengeId"],
          where: { challengeId: { in: [...allPromoIds] }, status: "AVAILABLE" },
          _count: { _all: true },
        })
      : [];
    const remainingByChallenge = new Map(remainingCounts.map((r) => [r.challengeId, r._count._all]));
    const withRemaining = <T extends { id: string; claimType: string }>(c: T) => ({
      ...c,
      remainingCodes: c.claimType === "PROMO" ? (remainingByChallenge.get(c.id) ?? 0) : null,
    });

    const visibleChallenges = challenges.map(withRemaining);
    const withParticipationRemaining = (p: (typeof participations)[number]) => ({
      ...p,
      challenge: withRemaining(p.challenge),
    });

    const active = participations.find((p) => p.status === "ACTIVE") ?? null;
    const paused = participations.filter((p) => p.status === "PAUSED");
    // Массив, а не одна: выполнить можно несколько целей и ни одной не
    // забрать — при .find() награда за вторую была бы не видна и не
    // забираема вовсе. Свежие первыми (orderBy completedAt desc выше).
    const completed = participations.filter((p) => p.status === "COMPLETED");

    // Уже выполненную цель нельзя брать повторно — второй промокод за ту
    // же цель не положен, поэтому не показываем её в каталоге.
    const completedIds = new Set(completed.map((p) => p.challengeId));
    const catalog = visibleChallenges.filter((c) => !completedIds.has(c.id));

    return NextResponse.json({
      challenges: catalog,
      active: active ? withParticipationRemaining(active) : null,
      paused: paused.map(withParticipationRemaining),
      completed: completed.map(withParticipationRemaining),
      stravaConnected: !!stravaAccount,
    });
  } catch (error) {
    console.error("GET /api/challenges error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
