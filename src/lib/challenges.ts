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

    // Новую активацию цели с уже пустым пулом не даём — только это
    // предотвратимо. Гонку «был код при активации, кончился при финише»
    // всё равно ловит ручной путь в deliverReward, здесь её не избежать.
    if (challenge.claimType === "PROMO") {
      const available = await tx.promoCode.count({ where: { challengeId, status: "AVAILABLE" } });
      if (available === 0) {
        throw new Error("PROMO_EXHAUSTED");
      }
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
 * Откладывает активную цель: прогресс остаётся как есть, километры
 * перестают в неё капать. Обратимо — вернуться к ней можно активировав
 * заново, прогресс не сгорает (см. activateChallenge).
 */
export async function pauseChallenge(userId: string, challengeId: string) {
  const result = await prisma.challengeParticipation.updateMany({
    where: { userId, challengeId, status: "ACTIVE" },
    data: { status: "PAUSED" },
  });
  if (result.count === 0) {
    throw new Error("NOT_ACTIVE");
  }
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
    await notifyGoalCompleted(userId, active.challengeId);
  }
}

/**
 * Сообщает, что цель закрыта и награду можно забрать. Промокод здесь НЕ
 * расходуется: он резервируется только по явному нажатию «Забрать» —
 * см. claimReward. Иначе код списывался бы в момент завершения, и если
 * сообщение не уходило (бот заблокирован, /start не нажат, сбой сети),
 * он сгорал молча и без возможности повторить.
 */
async function notifyGoalCompleted(userId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return;

  await sendTelegramMessageToUser(
    userId,
    `🎉 <b>Цель выполнена!</b>\n\n«${challenge.title}» от ${challenge.partner} — готово.\n\n` +
      `Забери награду в приложении, и я пришлю промокод сюда.`
  );
}

/**
 * Выдаёт промокод по явному действию пользователя: резервирует код,
 * отправляет его сообщением от бота и только при успешной отправке
 * оставляет код израсходованным. Если отправить не удалось — возвращает
 * код в пул, чтобы человек мог повторить, а не потерять награду.
 */
export async function claimReward(userId: string, challengeId: string) {
  const participation = await prisma.challengeParticipation.findUnique({
    where: { userId_challengeId: { userId, challengeId } },
    include: { challenge: true },
  });

  if (!participation || participation.status !== "COMPLETED") throw new Error("NOT_COMPLETED");
  if (participation.rewardSentAt) throw new Error("ALREADY_CLAIMED");

  // Резервируем код атомарно, чтобы два параллельных нажатия не забрали один
  const reserved = await prisma.$transaction(async (tx) => {
    const code = await tx.promoCode.findFirst({ where: { challengeId, status: "AVAILABLE" } });
    if (!code) return null;
    await tx.promoCode.update({
      where: { id: code.id },
      data: { status: "CLAIMED", claimedById: userId, claimedAt: new Date() },
    });
    return code;
  });

  if (!reserved) {
    console.error(`PromoCode pool exhausted for challenge ${challengeId}, user ${userId}`);
    throw new Error("PROMO_EXHAUSTED");
  }

  const { challenge } = participation;
  const sent = await sendTelegramMessageToUser(
    userId,
    `🎁 <b>${challenge.rewardLabel}</b>\n\n«${challenge.title}» от ${challenge.partner}\n\n` +
      `Твой промокод: <code>${reserved.code}</code>`
  );

  if (!sent) {
    // Отправить не смогли — возвращаем код в пул. Лучше дать повторить,
    // чем списать награду, которую человек так и не получил.
    await prisma.promoCode.update({
      where: { id: reserved.id },
      data: { status: "AVAILABLE", claimedById: null, claimedAt: null },
    });
    throw new Error("TELEGRAM_FAILED");
  }

  await prisma.challengeParticipation.update({
    where: { id: participation.id },
    data: { rewardSentAt: new Date() },
  });
}
