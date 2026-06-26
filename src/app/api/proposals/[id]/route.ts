import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const proposalId = params.id;
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

    const updated = await prisma.runProposal.update({
      where: { id: proposalId },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        pace,
        maxParticipants: maxParticipants !== undefined ? parseInt(maxParticipants) : undefined,
      }
    });

    return NextResponse.json({ success: true, proposal: updated });
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const proposalId = params.id;

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

    await prisma.runProposal.delete({
      where: { id: proposalId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
