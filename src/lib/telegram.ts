import { prisma } from '@/lib/prisma';

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
