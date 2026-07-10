import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic since it's a cron
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Runs starting within the next 90 minutes (1.5 hours)
    const timeWindow = new Date(now.getTime() + 90 * 60 * 1000);

    const { sendTelegramMessageToUser } = await import('@/lib/telegram');

    let notificationsSent = 0;

    // 1. Process Solo RunProposals
    const proposals = await prisma.runProposal.findMany({
      where: {
        status: "ACTIVE",
        reminderSent: false,
        startTime: {
          gt: now,
          lte: timeWindow
        }
      },
      include: {
        creator: true,
        requests: {
          where: { status: "ACCEPTED" },
          include: { user: true }
        }
      }
    });

    for (const proposal of proposals) {
      const eventDate = new Date(proposal.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) + ' мск';
      const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL || "";
      const link = botAppUrl ? `${botAppUrl}?startapp=focus_${proposal.id}` : "";
      
      const text = `⏳ <b>Скоро старт!</b>\n\nСовместная пробежка, на которую вы записались, начнется в ${eventDate}.\n\n📍 Проверьте место встречи на карте: ${link}`;

      const usersToNotify = [proposal.creatorId, ...proposal.requests.map(r => r.userId)];
      
      await Promise.allSettled(usersToNotify.map(uid => sendTelegramMessageToUser(uid, text)));
      notificationsSent += usersToNotify.length;

      await prisma.runProposal.update({
        where: { id: proposal.id },
        data: { reminderSent: true }
      });
    }

    // 2. Process Club Events
    const events = await prisma.event.findMany({
      where: {
        reminderSent: false,
        date: {
          gt: now,
          lte: timeWindow
        }
      },
      include: {
        club: true,
        attendees: true
      }
    });

    for (const event of events) {
      const eventDate = new Date(event.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) + ' мск';
      const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL || "";
      const link = botAppUrl ? `${botAppUrl}?startapp=focus_${event.id}` : "";
      
      const text = `⏳ <b>Скоро старт!</b>\n\nКлубная пробежка <i>${event.title}</i> начнется в ${eventDate}.\n\n📍 Проверьте маршрут и место встречи: ${link}`;

      const usersToNotify = event.attendees.map(a => a.id);
      
      await Promise.allSettled(usersToNotify.map(uid => sendTelegramMessageToUser(uid, text)));
      notificationsSent += usersToNotify.length;

      await prisma.event.update({
        where: { id: event.id },
        data: { reminderSent: true }
      });
    }

    return NextResponse.json({ success: true, notificationsSent });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
