import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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

    if (!currentMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 400 });
    }

    if (currentMember.role === "FOUNDER") {
      return NextResponse.json({ error: "Founders cannot leave the club. Disband it instead or transfer ownership." }, { status: 400 });
    }

    await prisma.clubMember.delete({
      where: { userId_clubId: { userId: currentUserId, clubId } }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Leave club error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
