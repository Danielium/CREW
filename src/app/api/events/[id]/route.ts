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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { 
        club: true, 
        checkedInUsers: true,
        attendees: true,
        runs: {
          include: { user: true }
        }
      }
    });
    
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const canManage = await hasManageRights(userId, id);
    
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const canManage = await hasManageRights(userId, id);
    
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, location, date, distance, pace, image } = await req.json();

    const event = await prisma.event.update({
      where: { id },
      data: {
        title,
        description,
        location,
        date: new Date(date),
        distance: distance ? parseFloat(distance) : null,
        pace: Array.isArray(pace) ? JSON.stringify(pace) : pace,
        image
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Update Event Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
