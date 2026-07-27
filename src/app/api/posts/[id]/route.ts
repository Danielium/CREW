import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    // Check if post exists and belongs to user
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch comments to delete their images
    const comments = await prisma.comment.findMany({
      where: { postId: id },
      select: { mediaUrl: true }
    });

    const { deleteMediaFromS3 } = await import("@/lib/uploadImage");

    if (post.mediaUrl) {
      await deleteMediaFromS3(post.mediaUrl);
    }

    const deletePromises = comments
      .filter(c => c.mediaUrl)
      .map(c => deleteMediaFromS3(c.mediaUrl));
      
    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }

    await prisma.post.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
