import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRun = await prisma.run.findFirst({
      where: { 
        userId: session.user.id,
        status: "IN_PROGRESS"
      },
      orderBy: { startTime: 'desc' }
    });

    if (!activeRun) {
      return NextResponse.json({ success: true, run: null });
    }

    return NextResponse.json({ success: true, run: activeRun });
  } catch (error) {
    console.error("Error fetching active run:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch active run" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Create an active run
    const run = await prisma.run.create({
      data: {
        userId: session.user.id,
        status: "IN_PROGRESS",
        eventId: body.eventId || null,
        routeData: "[]"
      }
    });

    return NextResponse.json({ success: true, run });
  } catch (error) {
    console.error("Error creating active run:", error);
    return NextResponse.json({ success: false, error: "Failed to create run" }, { status: 500 });
  }
}
