import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

async function hasManageRights(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { club: { include: { members: true } } }
  });
  
  if (!event) return false;
  if (event.creatorId === userId) return true;
  
  if (event.club) {
    const member = event.club.members.find(m => m.userId === userId && m.status === 'ACTIVE');
    if (member && (member.role === 'FOUNDER' || member.role === 'OFFICER')) {
      return true;
    }
  }
  return false;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminId = (session.user as any).id;
    const canManage = await hasManageRights(adminId, eventId);
    
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

    // Disconnect user from checkedInUsers (we can keep them in attendees or disconnect from both, user requested "kick from event", so let's disconnect from both to be safe)
    await prisma.event.update({
      where: { id: eventId },
      data: {
        checkedInUsers: { disconnect: { id: userId } },
        attendees: { disconnect: { id: userId } }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kick Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
