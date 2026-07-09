import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

async function hasManageRights(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { club: { include: { members: true } } }
  });
  
  if (!event) return false;
  if (event.creatorId === userId) return true;
  
  if (event.club) {
    const member = event.club.members.find(m => m.userId === userId && m.status === 'ACTIVE');
    if (member && (member.role === 'FOUNDER' || member.role === 'OFFICER')) {
      return true;
    }
  }
  return false;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { 
        club: true, 
        checkedInUsers: true,
        attendees: true,
        runs: {
          include: { user: true }
        }
      }
    });
    
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const canManage = await hasManageRights(userId, id);
    
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        attendees: { select: { id: true } },
        creator: { select: { name: true } }
      }
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Notify attendees
    if (event.attendees.length > 0) {
      const { sendTelegramMessageToUser } = await import('@/lib/telegram');
      const eventDate = new Date(event.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' мск';
      const text = `⚠️ <b>Отмена пробежки</b>\n\nОрганизатор <b>${event.creator?.name || "Аноним"}</b> отменил клубную пробежку <i>${event.title}</i>, запланированную на ${eventDate}.`;
      
      for (const attendee of event.attendees) {
        if (attendee.id !== event.creatorId) {
          sendTelegramMessageToUser(attendee.id, text).catch(console.error);
        }
      }
    }

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const canManage = await hasManageRights(userId, id);
    
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, location, date, distance, pace, image, routeData } = await req.json();

    const event = await prisma.event.update({
      where: { id },
      data: {
        title,
        description,
        location,
        date: new Date(date),
        distance: distance ? parseFloat(distance) : null,
        pace: Array.isArray(pace) ? JSON.stringify(pace) : pace,
        image,
        routeData: typeof routeData === 'string' ? routeData : (routeData ? JSON.stringify(routeData) : null)
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Update Event Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
