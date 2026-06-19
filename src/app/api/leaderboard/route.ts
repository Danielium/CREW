import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { totalDistance: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        image: true,
        totalDistance: true,
      }
    });

    return NextResponse.json({ users: topUsers });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
