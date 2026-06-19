import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from 'crypto';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await prisma.event.findUnique({
      where: { id },
      include: { club: { include: { members: true } } }
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as any).id;
    let canManage = event.creatorId === userId;
    if (!canManage && event.club) {
      const member = event.club.members.find(m => m.userId === userId && m.status === 'ACTIVE');
      if (member && (member.role === 'FOUNDER' || member.role === 'OFFICER')) {
        canManage = true;
      }
    }

    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!event.checkInToken) {
      const token = crypto.randomBytes(16).toString('hex');
      await prisma.event.update({
        where: { id },
        data: { checkInToken: token }
      });
      return NextResponse.json({ token });
    }

    return NextResponse.json({ token: event.checkInToken });
  } catch (error) {
    console.error("PIN Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
