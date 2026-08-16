/**
 * Заводит первую цель (Дринкит) и загружает пул промокодов.
 *
 * Промокоды — реальные, закупленные у партнёра. Впиши их в PROMO_CODES ниже
 * (или передай путь к текстовому файлу, по одному коду на строку, первым
 * аргументом), прежде чем запускать в проде.
 *
 * Запуск:
 *   node scripts/seed-drinkit-challenge.mjs [путь-к-файлу-с-кодами.txt]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

// Впиши реальные коды сюда, если не передаёшь файл аргументом.
const PROMO_CODES = [
  // "DRINKIT-XXXX-0001",
  // "DRINKIT-XXXX-0002",
];

async function main() {
  const filePath = process.argv[2];
  const codes = filePath
    ? readFileSync(filePath, "utf-8").split("\n").map((s) => s.trim()).filter(Boolean)
    : PROMO_CODES;

  if (codes.length === 0) {
    console.error(
      "Промокодов нет ни в PROMO_CODES, ни в переданном файле. " +
      "Цель без кодов заведётся, но при выполнении бот пришлёт пользователю " +
      "сообщение о временной задержке вместо кода — так что заполни коды до запуска."
    );
  }

  const challenge = await prisma.challenge.upsert({
    where: { slug: "drinkit-15" },
    update: {},
    create: {
      slug: "drinkit-15",
      partner: "Дринкит",
      title: "Первые пятнадцать",
      metric: "KM",
      target: 15,
      city: "Везде",
      claimType: "PROMO",
      rewardLabel: "Напиток в подарок", // ЗАГЛУШКА — заменить на реальное условие промокода
      isActive: true,
    },
  });

  console.log(`Цель "${challenge.title}" (${challenge.id}) готова.`);

  let added = 0;
  for (const code of codes) {
    const result = await prisma.promoCode.upsert({
      where: { challengeId_code: { challengeId: challenge.id, code } },
      update: {},
      create: { challengeId: challenge.id, code },
    });
    if (result) added++;
  }

  const available = await prisma.promoCode.count({
    where: { challengeId: challenge.id, status: "AVAILABLE" },
  });

  console.log(`Загружено кодов: ${added}. Доступно (не выдано): ${available}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
