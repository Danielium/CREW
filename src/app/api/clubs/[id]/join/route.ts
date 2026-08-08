import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// POST: join an OPEN club instantly, or file a PENDING request for an APPLICATION club.
export async function POST(req: Request, context: any) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const clubId = params.id;

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return NextResponse.json({ error: "Клуб не найден" }, { status: 404 });

    if (club.joinType === "INVITE_ONLY") {
      return NextResponse.json({ error: "Этот клуб закрыт для свободного вступления" }, { status: 403 });
    }

    const existingMembership = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId } }
    });
    if (existingMembership) {
      return NextResponse.json({ error: "Вы уже состоите в этом клубе или ваша заявка на рассмотрении" }, { status: 400 });
    }

    const activeInOther = await prisma.clubMember.findFirst({
      where: { userId, status: "ACTIVE" }
    });
    if (activeInOther) {
      return NextResponse.json({ error: "Вы уже состоите в другом клубе. Сначала покиньте его." }, { status: 400 });
    }

    const status = club.joinType === "APPLICATION" ? "PENDING" : "ACTIVE";

    await prisma.clubMember.create({
      data: { userId, clubId, role: "MEMBER", status }
    });

    if (status === "ACTIVE") {
      const { globalCache } = await import("@/lib/cache");
      globalCache.clubs = null;
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Join club error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
