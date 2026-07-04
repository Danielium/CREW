import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const requestingUserId = session?.user ? (session.user as any).id : null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        runs: {
          orderBy: { startTime: 'desc' }
        },
        clubMembers: {
          include: { club: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwner = requestingUserId === userId;

    if (user.isPrivate && !isOwner) {
      return NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          image: user.image,
          isPrivate: true
        }
      });
    }

    // Strip password field before sending response
    if (user.password) {
      delete (user as any).password;
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}


