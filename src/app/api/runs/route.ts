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

    // BUG-008 fix: anti-cheat validation
    const distance = Number(body.distance) || 0;
    const durationSec = Number(body.durationSec) || 0;
    const avgPace = distance > 0 ? (durationSec / 60) / distance : 0;
    if (distance > 150 || (distance > 0 && avgPace < 2.0)) {
      return NextResponse.json({ success: false, error: "Invalid run data" }, { status: 400 });
    }
    
    const run = await prisma.run.create({
      data: {
        userId: userId,
        distance: distance,
        durationSec: durationSec,
        avgPace: avgPace || body.avgPace,
        routeData: body.routeData ? JSON.stringify(body.routeData) : null,
        eventId: body.eventId || null,
        splits: body.splits || null,
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalDistance: {
          increment: distance
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

    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = parseInt(searchParams.get('skip') || '0');

    if (requestingUserId !== userId) {
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { isPrivate: true } });
      if (!targetUser || targetUser.isPrivate) {
        return NextResponse.json({ error: "Profile is private" }, { status: 403 });
      }
    }

    const runs = await prisma.run.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: limit > 100 ? 100 : limit,
      skip
    });
    
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
