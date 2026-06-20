import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');

    const topUsers = await prisma.user.findMany({
      where: clubId ? {
        clubMembers: {
          some: {
            clubId: clubId,
            status: "ACTIVE"
          }
        }
      } : undefined,
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
