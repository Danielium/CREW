import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const { id } = params;
    const { logoConfig } = await req.json();

    const member = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId: id } }
    });

    if (!member || member.role !== "FOUNDER" || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const club = await prisma.club.update({
      where: { id },
      data: { logoConfig }
    });

    // Clear global cache so updates propagate
    const { globalCache } = await import("@/lib/cache");
    globalCache.clubs = null;
    globalCache.userData = null;

    return NextResponse.json({ success: true, club });
  } catch (error) {
    console.error("Club logo update error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
