import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const requestingUserId = session?.user ? (session.user as any).id : null;
    const { id: targetUserId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        runs: {
          orderBy: { startTime: 'desc' }
        },
        clubMembers: {
          include: { club: true }
        },
        accounts: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwner = requestingUserId === targetUserId;

    if (user.isPrivate && !isOwner) {
      // Return stripped down data for private profiles
      return NextResponse.json({ 
        user: {
          id: user.id,
          name: user.name,
          image: user.image,
          isPrivate: true
        } 
      });
    }

    if (!isOwner) {
      delete (user as any).accounts;
    } else if (user.accounts) {
      // Strip sensitive tokens
      (user as any).accounts = user.accounts.map(acc => ({ provider: acc.provider }));
    }

    // Return full data
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Fetch user error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
