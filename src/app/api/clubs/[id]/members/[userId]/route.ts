import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// PATCH: approve or reject a pending member
export async function PATCH(req: Request, context: any) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUserId = (session.user as any).id;
    const clubId = params.id;
    const memberId = params.userId;

    // Check requester is founder
    const currentMember = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId: currentUserId, clubId } }
    });

    if (!currentMember || currentMember.role !== "FOUNDER") {
      return NextResponse.json({ error: "Only founders can manage members" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action; // "approve" or "reject"

    const targetMember = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId: memberId, clubId } }
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Check if user already has an active membership in another club
      const existingActive = await prisma.clubMember.findFirst({
        where: { userId: memberId, status: "ACTIVE" }
      });
      if (existingActive) {
        // Delete the pending request since they're already in a club
        await prisma.clubMember.delete({
          where: { userId_clubId: { userId: memberId, clubId } }
        });
        return NextResponse.json({ error: "Пользователь уже состоит в другом клубе" }, { status: 400 });
      }

      await prisma.clubMember.update({
        where: { userId_clubId: { userId: memberId, clubId } },
        data: { status: "ACTIVE" }
      });
      return NextResponse.json({ success: true, status: "ACTIVE" });
    } else if (action === "reject") {
      await prisma.clubMember.delete({
        where: { userId_clubId: { userId: memberId, clubId } }
      });
      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Manage member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: kick a member (founder only)
export async function DELETE(req: Request, context: any) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUserId = (session.user as any).id;
    const clubId = params.id;
    const memberId = params.userId;

    if (currentUserId === memberId) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    const currentMember = await prisma.clubMember.findUnique({
      where: { userId_clubId: { userId: currentUserId, clubId } }
    });

    if (!currentMember || currentMember.role !== "FOUNDER") {
      return NextResponse.json({ error: "Only founders can remove members" }, { status: 403 });
    }

    await prisma.clubMember.delete({
      where: { userId_clubId: { userId: memberId, clubId } }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
