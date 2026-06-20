import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const userId = session.user.id;
    
    const run = await prisma.run.update({
      where: { id: id, userId: userId },
      data: {
        status: "COMPLETED",
        distance: body.distance,
        durationSec: body.durationSec,
        avgPace: body.avgPace,
        routeData: body.routeData ? JSON.stringify(body.routeData) : null,
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

    if (run.eventId) {
      await prisma.event.update({
        where: { id: run.eventId },
        data: {
          checkedInUsers: { connect: { id: userId } },
          attendees: { connect: { id: userId } }
        }
      });
    }

    return NextResponse.json({ success: true, run });
  } catch (error) {
    console.error("Error stopping run:", error);
    return NextResponse.json({ success: false, error: "Failed to stop run" }, { status: 500 });
  }
}
