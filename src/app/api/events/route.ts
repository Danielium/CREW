import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ events: [] });
    }

    const userId = (session.user as any).id;
    
    // Fetch clubs where the user is an active member
    const userClubs = await prisma.clubMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: { clubId: true }
    });
    
    const clubIds = userClubs.map(c => c.clubId);

    const events = await prisma.event.findMany({
      where: { clubId: { in: clubIds } },
      include: {
        club: { select: { id: true, name: true } },
        attendees: { select: { id: true, image: true, name: true } }
      },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    
    // Check if user is FOUNDER or OFFICER of any club
    const activeClubMember = await prisma.clubMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        role: { in: ["FOUNDER", "OFFICER"] }
      },
      include: { club: true }
    });

    if (!activeClubMember) {
      return NextResponse.json({ error: "Только создатели и офицеры клуба могут создавать события" }, { status: 403 });
    }

    const { title, description, location, date, distance, pace, image, routeData } = await req.json();

    const checkInToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        date: new Date(date),
        distance: distance ? parseFloat(distance) : null,
        pace: Array.isArray(pace) ? JSON.stringify(pace) : pace,
        image,
        routeData: typeof routeData === 'string' ? routeData : (routeData ? JSON.stringify(routeData) : null),
        checkInToken,
        creatorId: userId,
        clubId: activeClubMember.clubId,
        attendees: { connect: [{ id: userId }] }
      }
    });

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error("Event creation error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
