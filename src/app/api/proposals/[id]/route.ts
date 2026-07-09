import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const proposalId = id;
    const body = await req.json();
    const { startTime, pace, maxParticipants } = body;

    const proposal = await prisma.runProposal.findUnique({
      where: { id: proposalId },
      select: { creatorId: true }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (proposal.creatorId !== (session.user as any).id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let parsedMax = undefined;
    if (maxParticipants !== undefined) {
      parsedMax = parseInt(maxParticipants);
      if (isNaN(parsedMax)) parsedMax = undefined;
    }

    const updated = await prisma.runProposal.update({
      where: { id: proposalId },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        pace,
        maxParticipants: parsedMax,
      }
    });

    return NextResponse.json({ success: true, proposal: updated });
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const proposalId = id;

    const proposal = await prisma.runProposal.findUnique({
      where: { id: proposalId },
      include: {
        creator: { select: { name: true } },
        requests: {
          where: { status: "ACCEPTED" },
          select: { userId: true }
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (proposal.creatorId !== (session.user as any).id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Notify accepted participants
    if (proposal.requests.length > 0) {
      const { sendTelegramMessageToUser } = await import('@/lib/telegram');
      const runDate = new Date(proposal.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' (мск)';
      const text = `⚠️ <b>Отмена пробежки</b>\n\nОрганизатор <b>${proposal.creator?.name || "Аноним"}</b> отменил пробежку, запланированную на <i>${runDate}</i>.`;
      
      for (const req of proposal.requests) {
        sendTelegramMessageToUser(req.userId, text).catch(console.error);
      }
    }

    await prisma.runProposal.delete({
      where: { id: proposalId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
