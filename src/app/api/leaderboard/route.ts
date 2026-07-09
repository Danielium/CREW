import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');

    if (clubId) {
      const topMembers = await prisma.clubMember.findMany({
        where: { clubId, status: "ACTIVE" },
        orderBy: { clubDistance: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, image: true, totalDistance: true }
          }
        }
      });
      // Map it to match the expected users format, but override totalDistance with clubDistance for the UI to display
      const topUsers = topMembers.map(m => ({
        ...m.user,
        totalDistance: m.clubDistance 
      }));
      return NextResponse.json({ users: topUsers });
    }

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
