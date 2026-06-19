import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as OTPAuth from "otpauth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "Event ID is required" }, { status: 400 });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { checkedInUsers: true }
    });

    if (!event) {
      return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
    }

    const userId = (session.user as any).id;

    const alreadyCheckedIn = event.checkedInUsers.some(u => u.id === userId);
    if (alreadyCheckedIn) {
      return NextResponse.json({ error: "Вы уже чекинились на этот забег!" }, { status: 400 });
    }

    // Connect user to both attendees (RSVP) and checkedInUsers
    await prisma.event.update({
      where: { id: event.id },
      data: {
        attendees: {
          connect: { id: userId }
        },
        checkedInUsers: {
          connect: { id: userId }
        }
      }
    });

    return NextResponse.json({ success: true, eventId: event.id, eventTitle: event.title });
  } catch (error: any) {
    console.error("Checkin Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
