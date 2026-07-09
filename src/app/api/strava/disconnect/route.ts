import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const account = await prisma.account.findFirst({
      where: { userId, provider: "strava" }
    });

    if (!account) {
      return NextResponse.json({ error: "Strava not connected" }, { status: 404 });
    }

    await prisma.account.delete({ where: { id: account.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error disconnecting Strava:", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
