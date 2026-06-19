import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, image: true }
        },
        run: true,
        _count: {
          select: { likes: true, comments: true }
        }
      }
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await prisma.event.findMany({
      where: {
        date: { gte: yesterday }
      },
      orderBy: { date: 'asc' },
      take: 5,
      include: {
        club: true,
        creator: true,
        attendees: { select: { id: true, image: true, name: true } }
      }
    });

    return NextResponse.json({ posts, events });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
