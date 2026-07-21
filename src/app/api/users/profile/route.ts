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

    const { name, image, isPrivate, notifyClubEvents } = await req.json();

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      if (name.length > 50) {
        return NextResponse.json({ error: "Name is too long" }, { status: 400 });
      }
    }

    if (image !== undefined && image !== null) {
      if (typeof image !== "string") {
        return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
      }
      if (image.startsWith("javascript:")) {
        return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: (session.user as any).id },
      data: {
        name: name !== undefined ? name : undefined,
        image: image !== undefined ? image : undefined,
        isPrivate: isPrivate !== undefined ? isPrivate : undefined,
        notifyClubEvents: notifyClubEvents !== undefined ? notifyClubEvents : undefined,
      },
    });

    return NextResponse.json({ user: updatedUser });
    } catch (error: any) {
      console.error("Failed to update profile", error);
      return NextResponse.json({ error: "Failed to update profile: " + error.message }, { status: 500 });
    }
}
