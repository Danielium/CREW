import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const userId = (session.user as any).id;
    const body = await req.json();

    const userExists = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { clubMembers: { where: { status: { in: ["ACTIVE", "PENDING"] } } } }
    });
    
    if (!userExists) {
      await prisma.user.create({
        data: {
          id: userId,
          telegramUsername: session.user.email || `@recovered-${userId}`,
          name: session.user.name || "Runner",
        }
      });
    } else if (userExists.clubMembers.length > 0) {
      return NextResponse.json({ error: "Вы уже состоите в клубе или ваша заявка на рассмотрении" }, { status: 400 });
    }

    const { name, description, joinType, tags, logoConfig } = body;
    
    const { randomBytes } = await import('crypto');
    const inviteCode = randomBytes(4).toString('hex').toUpperCase(); // 8 characters

    const club = await prisma.club.create({
      data: {
        name,
        description,
        joinType: joinType || "OPEN",
        tags: JSON.stringify(tags || []),
        logoConfig: JSON.stringify(logoConfig || {}),
        inviteCode,
        members: {
          create: {
            userId: (session.user as any).id,
            role: "FOUNDER",
            status: "ACTIVE"
          }
        }
      }
    });

    return NextResponse.json({ club });
  } catch (error: any) {
    console.error("Club creation error", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const clubs = await prisma.club.findMany({
      include: {
        _count: {
          select: { members: { where: { status: "ACTIVE" } } }
        }
      },
      orderBy: {
        totalClubDistance: 'desc'
      }
    });
    return NextResponse.json({ clubs });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
