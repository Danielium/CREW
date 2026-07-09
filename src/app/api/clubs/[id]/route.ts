import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const club = await prisma.club.findUnique({
      where: { id: id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, image: true, totalDistance: true } } },
          orderBy: { clubDistance: 'desc' }
        },
        events: {
          where: { date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          orderBy: { date: 'asc' },
          include: { attendees: { select: { id: true, image: true, name: true } } }
        }
      }
    });

    if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
    return NextResponse.json({ club });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, context: any) {
  // Join club logic
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const club = await prisma.club.findUnique({ where: { id: params.id } });
    if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

    const existingClubMembership = await prisma.clubMember.findFirst({
      where: { userId: (session.user as any).id, status: "ACTIVE" }
    });

    if (existingClubMembership) {
      return NextResponse.json({ error: "Вы уже состоите в клубе. Можно состоять только в одном клубе одновременно." }, { status: 400 });
    }

    const membersCount = await prisma.clubMember.count({
      where: { clubId: params.id, status: "ACTIVE" }
    });

    if (membersCount >= 1000) {
      return NextResponse.json({ error: "Клуб достиг максимального количества участников (1000)." }, { status: 400 });
    }

    const existingPending = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId: (session.user as any).id, clubId: params.id } }
    });

    if (existingPending) {
      if (existingPending.status === "KICKED") {
        const newStatus = club.joinType === "APPLICATION" ? "PENDING" : "ACTIVE";
        const member = await prisma.clubMember.update({
          where: { id: existingPending.id },
          data: { status: newStatus, role: "MEMBER" }
        });
        return NextResponse.json({ member, status: newStatus });
      }
      return NextResponse.json({ error: "Already a member or pending" }, { status: 400 });
    }

    if (club.joinType === "INVITE_ONLY") {
      return NextResponse.json({ error: "Этот клуб доступен только по коду приглашения" }, { status: 403 });
    }
    const status = club.joinType === "APPLICATION" ? "PENDING" : "ACTIVE";

    // Auto-leave old club if already in one
    const activeInOther = await prisma.clubMember.findFirst({
      where: { userId: (session.user as any).id, status: "ACTIVE" }
    });
    if (activeInOther) {
      await prisma.clubMember.delete({
        where: { id: activeInOther.id }
      });
    }

    const member = await prisma.clubMember.create({
      data: {
        userId: (session.user as any).id,
        clubId: params.id,
        role: "MEMBER",
        status
      }
    });

    return NextResponse.json({ member, status });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUserId = (session.user as any).id;
    const clubId = params.id;

    const currentMember = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId: currentUserId, clubId } }
    });

    if (!currentMember || currentMember.role !== "FOUNDER" || currentMember.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only active founders can disband the club" }, { status: 403 });
    }

    await prisma.club.delete({
      where: { id: clubId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Disband club error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

