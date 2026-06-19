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

    if (!code) {
      return NextResponse.json({ error: "Код не указан" }, { status: 400 });
    }

    const club = await prisma.club.findUnique({
      where: { inviteCode: code }
    });

    if (!club) {
      return NextResponse.json({ error: "Клуб с таким кодом не найден" }, { status: 404 });
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
      return NextResponse.json({ error: "Вы уже состоите в другом клубе. Сначала покиньте его." }, { status: 400 });
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
    console.error("Join by invite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
