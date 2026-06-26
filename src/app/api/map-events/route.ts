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

    return NextResponse.json({ proposals: visibleProposals });
  } catch (error) {
    console.error("Map events fetch error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
