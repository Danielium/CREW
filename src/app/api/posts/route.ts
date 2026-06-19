import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.content && !body.mediaUrl) {
      return NextResponse.json({ error: "content or mediaUrl is required" }, { status: 400 });
    }

    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        type: body.mediaUrl ? "MEDIA" : "TEXT",
        content: body.content || null,
        mediaUrl: body.mediaUrl || null,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
        _count: { select: { likes: true, comments: true } }
      }
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
