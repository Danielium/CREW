import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, image: true, totalDistance: true }
        },
        run: true,
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
        attendees: { select: { id: true, image: true, name: true, totalDistance: true } }
      }
    });

    return NextResponse.json({ posts: formattedPosts, events });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
