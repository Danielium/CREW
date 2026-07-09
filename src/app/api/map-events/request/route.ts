import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Send swipe-to-join request
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { proposalId } = await req.json();
    const userId = (session.user as any).id;

    // Check if proposal exists and not full
    const proposal = await prisma.runProposal.findUnique({
      where: { id: proposalId },
      include: {
        _count: {
          select: { requests: { where: { status: "ACCEPTED" } } }
        }
      }
    });

    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    if (proposal.creatorId === userId) return NextResponse.json({ error: "Cannot join your own run" }, { status: 400 });
    
    if (proposal.maxParticipants > 0 && proposal._count.requests >= proposal.maxParticipants) {
      return NextResponse.json({ error: "Run is full" }, { status: 400 });
    }

    // Create request (upsert to handle if they already requested and it was rejected, we can let them retry? MVP: just create, Prisma unique constraint handles duplicates)
    const request = await prisma.runJoinRequest.create({
      data: {
        proposalId,
        userId,
        status: "PENDING"
      },
      include: {
        user: true,
        proposal: {
          include: {
            creator: true
          }
        }
      }
    });

    // Send Telegram Notification to the Creator
    if (request.proposal.creatorId !== userId) {
      const { sendTelegramMessageToUser } = await import('@/lib/telegram');
      
      // We don't expose requester's TG username here for privacy until accepted, but we can show their name
      const runDate = new Date(request.proposal.startTime).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const text = `🏃 <b>Новая заявка на пробежку!</b>\n\nАтлет <b>${request.user.name || "Аноним"}</b> хочет присоединиться к вашей пробежке, запланированной на <i>${runDate}</i>.\n\nЧто делаем?`;
      
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Принять", callback_data: `accept_req_${request.id}` },
            { text: "❌ Отклонить", callback_data: `reject_req_${request.id}` }
          ]
        ]
      };

      // Best effort send
      sendTelegramMessageToUser(request.proposal.creatorId, text, replyMarkup).catch(console.error);
    }

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Запрос уже отправлен" }, { status: 400 });
    }
    console.error("RunJoinRequest error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Accept/Reject request
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { requestId, status } = await req.json(); // status: ACCEPTED | REJECTED
    const userId = (session.user as any).id;

    if (status !== "ACCEPTED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const request = await prisma.runJoinRequest.findUnique({
      where: { id: requestId },
      include: { proposal: true }
    });

    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (request.proposal.creatorId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const updated = await prisma.runJoinRequest.update({
      where: { id: requestId },
      data: { status }
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Get incoming requests & confirmed matches for the Bell Inbox
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id;

    // 1. Incoming requests to my proposals (PENDING)
    const incomingPending = await prisma.runJoinRequest.findMany({
      where: {
        proposal: { creatorId: userId },
        status: "PENDING"
      },
      include: {
        user: { select: { name: true, image: true, totalDistance: true } }, // Do NOT reveal tg username until accepted!
        proposal: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Matches where I am creator (ACCEPTED) - reveal TG
    const myAccepted = await prisma.runJoinRequest.findMany({
      where: {
        proposal: { creatorId: userId },
        status: "ACCEPTED"
      },
      include: {
        user: { select: { name: true, image: true, telegramUsername: true } },
        proposal: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Matches where I am requester (ACCEPTED) - reveal TG of creator
    const myRequestsAccepted = await prisma.runJoinRequest.findMany({
      where: {
        userId: userId,
        status: "ACCEPTED"
      },
      include: {
        proposal: {
          include: {
            creator: { select: { name: true, image: true, telegramUsername: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
      incomingPending, 
      matches: {
        asCreator: myAccepted,
        asParticipant: myRequestsAccepted
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Cancel a request / Leave a run
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const proposalId = url.searchParams.get("proposalId");
    const userId = (session.user as any).id;

    if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

    await prisma.runJoinRequest.deleteMany({
      where: {
        proposalId,
        userId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
