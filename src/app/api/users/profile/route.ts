import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, image, isPrivate } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { id: (session.user as any).id },
      data: {
        name: name !== undefined ? name : undefined,
        image: image !== undefined ? image : undefined,
        isPrivate: isPrivate !== undefined ? isPrivate : undefined,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Failed to update profile", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
