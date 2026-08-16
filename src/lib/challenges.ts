import { prisma } from "@/lib/prisma";
import { sendTelegramMessageToUser } from "@/lib/telegram";

/**
 * Активирует цель для пользователя: приостанавливает прежнюю активную (если
 * была — прогресс сохраняется, не обнуляется) и активирует/создаёт участие
 * в новой. Километры в новую цель считаются только с момента активации.
 */
export async function activateChallenge(userId: string, challengeId: string) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !challenge.isActive) {
      throw new Error("CHALLENGE_NOT_FOUND");
    }

    const existing = await tx.challengeParticipation.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    // Иначе реактивация уже выполненной цели: прогресс уже >= target, и
    // следующая же пробежка выдаст второй промокод за ту же цель.
    if (existing?.status === "COMPLETED") {
      throw new Error("ALREADY_COMPLETED");
    }

    await tx.challengeParticipation.updateMany({
      where: { userId, status: "ACTIVE", NOT: { challengeId } },
      data: { status: "PAUSED" },
    });

    const participation = await tx.challengeParticipation.upsert({
      where: { userId_challengeId: { userId, challengeId } },
      update: { status: "ACTIVE" },
      create: { userId, challengeId, status: "ACTIVE" },
    });

    return { participation, challenge };
  });
}

/**
 * Начисляет километры из подтверждённой пробежки в активную цель
 * пользователя (если она есть). Вызывается из Strava-синка и вебхука —
 * единственных источников пробежек в приложении.
 *
 * Пробежки до момента активации цели не считаются (anti-cheat, тот же
 * принцип, что и у клубного зачёта).
 */
export async function addChallengeProgress(userId: string, distanceKm: number, runStartTime: Date) {
  const active = await prisma.challengeParticipation.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { challenge: true },
  });

  if (!active || runStartTime < active.activatedAt) return;

  const newProgress = active.progress + distanceKm;
  const justCompleted = newProgress >= active.challenge.target;

  await prisma.challengeParticipation.update({
    where: { id: active.id },
    data: {
      progress: newProgress,
      ...(justCompleted ? { status: "COMPLETED", completedAt: new Date() } : {}),
    },
  });

  if (justCompleted) {
    await deliverReward(userId, active.challengeId);
  }
}

/**
 * Выдаёт промокод из пула партнёра и присылает его сообщением от бота —
 * промо не показывается в приложении, только в Telegram.
 */
async function deliverReward(userId: string, challengeId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const code = await tx.promoCode.findFirst({
      where: { challengeId, status: "AVAILABLE" },
    });
    if (!code) return null;

    await tx.promoCode.update({
      where: { id: code.id },
      data: { status: "CLAIMED", claimedById: userId, claimedAt: new Date() },
    });
    await tx.challengeParticipation.updateMany({
      where: { userId, challengeId },
      data: { rewardSentAt: new Date() },
    });

    const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });
    return { code, challenge };
  });

  if (!result) {
    // Пул промокодов пуст — цель выполнена, но выдать нечего.
    // Не молчим: шлём то, что есть, чтобы человек не подумал, что бота сломали.
    console.error(`PromoCode pool exhausted for challenge ${challengeId}, user ${userId}`);
    await sendTelegramMessageToUser(
      userId,
      `🎉 Ты выполнил цель в CREW! Награда закончилась на складе — мы уже знаем и разберёмся, напишем отдельно.`
    );
    return;
  }

  const { code, challenge } = result;
  await sendTelegramMessageToUser(
    userId,
    `🎉 <b>Цель выполнена!</b>\n\n«${challenge!.title}» от ${challenge!.partner} — готово.\n\n` +
      `${challenge!.rewardLabel}\nТвой промокод: <code>${code.code}</code>`
  );
}
