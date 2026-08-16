import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pauseChallenge } from "@/lib/challenges";

export async function POST(request: Request, context: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const params = await context.params;
    await pauseChallenge(userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "NOT_ACTIVE") {
      return NextResponse.json({ error: "Эта цель сейчас не активна" }, { status: 409 });
    }
    console.error("POST /api/challenges/[id]/pause error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
