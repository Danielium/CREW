import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { linkTelegramAccount } from '@/lib/telegram';
import { verifyTelegramInitData, parseTelegramUser } from '@/lib/telegramInitData';

/**
 * Links the caller's numeric Telegram id to their CREW account.
 *
 * The auth provider only runs on a fresh sign-in, so users holding a valid JWT
 * (up to 30 days) would never get linked. The Mini App calls this on every open
 * instead, which covers long-lived sessions without a re-login.
 */
export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[tg-link] TELEGRAM_BOT_TOKEN is missing');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const { initData } = await req.json();
    if (!initData || typeof initData !== 'string') {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    if (!verifyTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid initData signature' }, { status: 401 });
    }

    const tgUser = parseTelegramUser(initData);
    if (!tgUser) {
      return NextResponse.json({ error: 'No user in initData' }, { status: 400 });
    }

    // Prefer the logged-in user; fall back to matching the verified username.
    const session = await getServerSession(authOptions);
    let userId = (session?.user as any)?.id as string | undefined;

    if (!userId && tgUser.username) {
      const user = await prisma.user.findUnique({
        where: { telegramUsername: tgUser.username },
        select: { id: true }
      });
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ linked: false, reason: 'no-user' });
    }

    const result = await linkTelegramAccount(userId, tgUser.id);
    return NextResponse.json({ linked: true, result });
  } catch (error) {
    console.error('[tg-link] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
