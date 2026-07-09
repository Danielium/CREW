import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, context: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const params = await context.params;
    const eventId = params.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { attendees: { select: { id: true } } }
    });

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const isAttending = event.attendees.some(a => a.id === userId);

    if (isAttending) {
      // Leave
      await prisma.event.update({
        where: { id: eventId },
        data: {
          attendees: { disconnect: [{ id: userId }] }
        }
      });
      
      // Notify creator
      if (event.creatorId !== userId) {
        const { sendTelegramMessageToUser } = await import('@/lib/telegram');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const eventDate = new Date(event.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' мск';
        const usernameText = user?.telegramUsername ? ` (${user.telegramUsername})` : "";
        const text = `⚠️ <b>Отмена участия</b>\n\nАтлет <b>${user?.name || "Аноним"}</b>${usernameText} передумал и отменил свое участие в клубной пробежке <i>${event.title}</i> (${eventDate}).`;
        sendTelegramMessageToUser(event.creatorId, text).catch(console.error);
      }
      
      return NextResponse.json({ attending: false });
    } else {
      // Join
      if (event.clubId) {
        const membership = await prisma.clubMember.findUnique({
          where: { userId_clubId: { userId, clubId: event.clubId } }
        });
        if (!membership || membership.status !== "ACTIVE") {
          return NextResponse.json({ error: "Только активные участники клуба могут присоединиться к этому событию" }, { status: 403 });
        }
      }

      await prisma.event.update({
        where: { id: eventId },
        data: {
          attendees: { connect: [{ id: userId }] }
        }
      });
      
      // Notify creator
      if (event.creatorId !== userId) {
        const { sendTelegramMessageToUser } = await import('@/lib/telegram');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const eventDate = new Date(event.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' мск';
        const usernameText = user?.telegramUsername ? ` (${user.telegramUsername})` : "";
        const text = `🏃 <b>Новый участник!</b>\n\nАтлет <b>${user?.name || "Аноним"}</b>${usernameText} присоединился к клубной пробежке <i>${event.title}</i>, запланированной на ${eventDate}.`;
        sendTelegramMessageToUser(event.creatorId, text).catch(console.error);
      }
      
      return NextResponse.json({ attending: true });
    }
  } catch (error: any) {
    console.error("Join event error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
