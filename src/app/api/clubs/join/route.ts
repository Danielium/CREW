import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST: join a club by invite code
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const code = body.code?.trim();
    const clubId = body.clubId;
    const autoLeave = body.autoLeave;

    if (!code && !clubId) {
      return NextResponse.json({ error: "Код или ID клуба не указаны" }, { status: 400 });
    }

    let club = null;
    
    if (code) {
      club = await prisma.club.findUnique({ where: { inviteCode: code } });
    } else if (clubId) {
      club = await prisma.club.findUnique({ where: { id: clubId } });
      if (club && club.joinType !== "OPEN") {
        return NextResponse.json({ error: "Этот клуб не открыт для свободного вступления" }, { status: 403 });
      }
    }

    if (!club) {
      return NextResponse.json({ error: "Клуб не найден" }, { status: 404 });
    }

    const userId = (session.user as any).id;

    // Check if already in this club
    const existingMembership = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId: club.id } }
    });

    if (existingMembership) {
      return NextResponse.json({ error: "Вы уже состоите в этом клубе" }, { status: 400 });
    }

    // Check if already in another club
    const activeInOther = await prisma.clubMember.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    if (activeInOther) {
      if (autoLeave) {
        await prisma.clubMember.delete({
          where: { id: activeInOther.id }
        });
      } else {
        return NextResponse.json({ error: "Вы уже состоите в другом клубе. Сначала покиньте его." }, { status: 400 });
      }
    }

    const member = await prisma.clubMember.create({
      data: {
        userId,
        clubId: club.id,
        role: "MEMBER",
        status: "ACTIVE"
      }
    });

    return NextResponse.json({ success: true, clubId: club.id, clubName: club.name });
  } catch (error) {
    console.error("Join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
