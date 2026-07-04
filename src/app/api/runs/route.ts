import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;
    
    const run = await prisma.run.create({
      data: {
        userId: userId,
        distance: body.distance,
        durationSec: body.durationSec,
        avgPace: body.avgPace,
        routeData: body.routeData ? JSON.stringify(body.routeData) : null,
        eventId: body.eventId || null,
        splits: body.splits || null,
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalDistance: {
          increment: body.distance
        }
      }
    });

    // Update club totalClubDistance if user is in a club
    const activeMembership = await prisma.clubMember.findFirst({
      where: { userId: userId, status: "ACTIVE" }
    });
    if (activeMembership) {
      await prisma.club.update({
        where: { id: activeMembership.clubId },
        data: { totalClubDistance: { increment: body.distance } }
      });
    }

    if (body.eventId) {
      await prisma.event.update({
        where: { id: body.eventId },
        data: {
          checkedInUsers: { connect: { id: userId } },
          attendees: { connect: { id: userId } }
        }
      });
    }

    return NextResponse.json({ success: true, run });
  } catch (error) {
    console.error("Error saving run:", error);
    return NextResponse.json({ success: false, error: "Failed to save run" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const requestingUserId = session?.user ? (session.user as any).id : null;

    if (requestingUserId !== userId) {
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { isPrivate: true } });
      if (!targetUser || targetUser.isPrivate) {
        return NextResponse.json({ error: "Profile is private" }, { status: 403 });
      }
    }

    const runs = await prisma.run.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: 20
    });
    
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
