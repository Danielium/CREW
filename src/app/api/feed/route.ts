import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const scope = new URL(request.url).searchParams.get('scope') === 'club' ? 'club' : 'all';

    // "Мой клуб" — посты всех активных участников клубов, где я сам активный участник
    let clubAuthorIds: string[] | null = null;
    if (scope === 'club') {
      if (!userId) return NextResponse.json({ posts: [], events: [], hasClub: false });

      const myClubs = await prisma.clubMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { clubId: true },
      });

      if (myClubs.length === 0) {
        return NextResponse.json({ posts: [], events: [], hasClub: false });
      }

      const clubmates = await prisma.clubMember.findMany({
        where: { clubId: { in: myClubs.map(c => c.clubId) }, status: 'ACTIVE' },
        select: { userId: true },
      });
      clubAuthorIds = [...new Set(clubmates.map(m => m.userId))];
    }

    const posts = await prisma.post.findMany({
      where: clubAuthorIds ? { userId: { in: clubAuthorIds } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, image: true }
        },
        _count: {
          select: { likes: true, comments: true }
        },
        ...(userId ? {
          likes: {
            where: { userId }
          }
        } : {})
      }
    });

    const formattedPosts = posts.map(post => {
      const isLiked = userId ? post.likes && post.likes.length > 0 : false;
      const { likes, ...rest } = post as any;
      return { ...rest, isLiked };
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

    return NextResponse.json({ posts: formattedPosts, events, hasClub: scope === 'club' });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
