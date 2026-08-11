import { prisma } from '@/lib/prisma';

/**
 * Links a numeric Telegram id to a CREW user so the bot can message them.
 * Idempotent: re-linking an id that already points at this user is a no-op.
 */
export async function linkTelegramAccount(userId: string, telegramId: string) {
  const existing = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'telegram', providerAccountId: telegramId } }
  });

  if (existing) {
    // Same Telegram account moved to a different CREW user (e.g. username changed
    // and a new User row was created) — repoint it instead of leaving it stale.
    if (existing.userId !== userId) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { userId }
      });
      return 'relinked';
    }
    return 'already-linked';
  }

  await prisma.account.create({
    data: {
      userId,
      type: 'oauth',
      provider: 'telegram',
      providerAccountId: telegramId,
    }
  });
  return 'linked';
}

/**
 * Sends a message to a user via the Telegram Bot API.
 * Looks up the user's Telegram chat_id via the Account table.
 */
export async function sendTelegramMessageToUser(userId: string, text: string, replyMarkup?: any) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is missing");
    return false;
  }

  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider: 'telegram' }
    });

    if (!account || !account.providerAccountId) {
      console.log(`User ${userId} does not have a linked Telegram account.`);
      return false;
    }

    const chatId = account.providerAccountId;

    const payload: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to send TG message to ${chatId}:`, errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("sendTelegramMessageToUser error:", error);
    return false;
  }
}
