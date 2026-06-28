import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Create RunProposal
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lat, lng, routeData, pace, startTime, maxParticipants } = await req.json();

    const proposal = await prisma.runProposal.create({
      data: {
        creatorId: (session.user as any).id,
        lat,
        lng,
        routeData: routeData ? JSON.stringify(routeData) : null,
        pace,
        startTime: new Date(startTime),
        maxParticipants: maxParticipants || 0,
      }
    });

    return NextResponse.json({ success: true, proposal });
  } catch (error: any) {
    console.error("RunProposal creation error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Get Active RunProposals
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    // User can be unauth to just see the map, but let's assume auth is needed to join
    
    // Fetch all active proposals for MVP. In future, filter by bounds (lat/lng)
    const proposals = await prisma.runProposal.findMany({
      where: {
        status: "ACTIVE",
        startTime: {
          gt: new Date() // Only future runs
        }
      },
      include: {
        _count: {
          select: { requests: { where: { status: "ACCEPTED" } } }
        },
        creator: {
          select: {
            id: true, // Needed to check if it's our own
          }
        },
        requests: {
          where: { userId: session?.user ? (session.user as any).id : "" },
          select: { status: true }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    const userId = session?.user ? (session.user as any).id : "";

    const visibleProposals = proposals.filter((p) => {
      // If no limit or not full, show it
      if (p.maxParticipants === 0 || p._count.requests < p.maxParticipants) {
        return true;
      }
      // If full, only show to creator or accepted participants
      if (p.creator.id === userId) return true;
      if (p.requests.some(r => r.status === "ACCEPTED")) return true;
      return false;
    });

    const formattedProposals = visibleProposals.map(p => ({ type: "DUO", ...p }));

    // Fetch club events
    const clubEvents = await prisma.event.findMany({
      where: {
        clubId: { not: null },
        routeData: { not: null },
        date: { gt: new Date() },
        OR: userId ? [
          { club: { joinType: "OPEN" } },
          { attendees: { some: { id: userId } } },
          { club: { members: { some: { userId: userId, status: "ACTIVE" } } } }
        ] : [
          { club: { joinType: "OPEN" } }
        ]
      },
      include: {
        club: {
          select: { id: true, name: true, logoConfig: true, joinType: true, members: { select: { userId: true, status: true } } }
        },
        attendees: {
          select: { id: true, image: true, name: true }
        }
      }
    });

    const mappedClubEvents = clubEvents.map(event => {
      let lat = 0;
      let lng = 0;
      try {
        if (event.routeData) {
          const route = JSON.parse(event.routeData);
          if (route && route.length > 0) {
            lat = route[0].lat;
            lng = route[0].lng;
          }
        }
      } catch (e) {}
      
      return {
        type: "CLUB",
        id: event.id,
        lat,
        lng,
        startTime: event.date,
        event: event,
        isMember: userId ? (
          event.club?.members?.some((m: any) => m.userId === userId && m.status === "ACTIVE") || false
        ) : false
      };
    }).filter(e => e.lat !== 0 && e.lng !== 0);

    const combinedProposals = [...formattedProposals, ...mappedClubEvents];

    return NextResponse.json({ proposals: combinedProposals });
  } catch (error) {
    console.error("Map events fetch error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
